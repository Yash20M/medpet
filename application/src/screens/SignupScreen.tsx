import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView, Animated, Easing, ActivityIndicator,
  KeyboardAvoidingView, Platform, BackHandler, Modal, Pressable, FlatList,
  TextInput as RNTextInput, StatusBar, useWindowDimensions,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Ionicons from '../components/Icon';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { usePets } from '../context/PetsContext';
import PressableScale from '../components/PressableScale';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { PetType } from '../types/pet.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Signup'> };

/**
 * Signup is a guided, one-question-per-screen flow:
 *   about you → pet's name → kind of pet → breed → age → password.
 * The account is created on the last step, then the pet is saved to it.
 */
type StepKey = 'about' | 'petName' | 'petType' | 'breed' | 'age' | 'account';
const STEPS: StepKey[] = ['about', 'petName', 'petType', 'breed', 'age', 'account'];

const PET_TYPES: { value: PetType; label: string; emoji: string }[] = [
  { value: 'dog', label: 'Dog', emoji: '🐶' },
  { value: 'cat', label: 'Cat', emoji: '🐱' },
  { value: 'bird', label: 'Bird', emoji: '🐦' },
  { value: 'fish', label: 'Fish', emoji: '🐠' },
  { value: 'rabbit', label: 'Rabbit', emoji: '🐰' },
  { value: 'horse', label: 'Horse', emoji: '🐴' },
  { value: 'reptile', label: 'Reptile', emoji: '🦎' },
  { value: 'other', label: 'Other', emoji: '🐾' },
];

/** "Less than 1 year", "1 year old" … "25 years old" */
const AGE_OPTIONS: { label: string; years: number }[] = [
  { label: 'Less than 1 year', years: 0 },
  ...Array.from({ length: 25 }, (_, i) => ({
    label: `${i + 1} year${i === 0 ? '' : 's'} old`,
    years: i + 1,
  })),
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digits = (s: string) => s.replace(/\D/g, '');

/** Hero art per step: soft gradient + a floating emoji group. Swap for real photos later. */
const HERO: Record<StepKey, { colors: [string, string]; emojis: string[] }> = {
  about:   { colors: ['#D1FAE5', '#A7F3D0'], emojis: ['🐶', '🧑', '🐱'] },
  petName: { colors: ['#E0F2FE', '#BAE6FD'], emojis: ['🐱', '🐶'] },
  petType: { colors: ['#FEF3C7', '#FDE68A'], emojis: ['🐱', '🐶'] },
  breed:   { colors: ['#FFE4E6', '#FECDD3'], emojis: ['🐾'] },
  age:     { colors: ['#EDE9FE', '#DDD6FE'], emojis: ['🎂'] },
  account: { colors: ['#D1FAE5', '#6EE7B7'], emojis: ['🔐', '🐾'] },
};

const Hero = ({ step, petEmoji }: { step: StepKey; petEmoji: string }) => {
  const float = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  useEffect(() => {
    swap.setValue(0);
    Animated.spring(swap, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }).start();
  }, [step, swap]);

  const art = HERO[step];
  // Once the pet's kind is known, show it on the breed / age screens.
  const emojis = (step === 'breed' || step === 'age') && petEmoji
    ? (step === 'age' ? ['🎂', petEmoji] : [petEmoji])
    : art.emojis;

  const bob = float.interpolate({ inputRange: [0, 1], outputRange: [4, -8] });
  const tilt = float.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });
  const pop = swap.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <LinearGradient colors={art.colors} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={[styles.blob, { top: -50, right: -40, width: 200, height: 200, borderRadius: 100 }]} />
      <View style={[styles.blob, { bottom: 10, left: -50, width: 150, height: 150, borderRadius: 75 }]} />
      <Animated.View
        style={[styles.heroArt, { opacity: swap, transform: [{ scale: pop }, { translateY: bob }, { rotate: tilt }] }]}
      >
        {emojis.map((e, i) => (
          <Text
            key={`${step}-${i}`}
            allowFontScaling={false}
            style={[styles.heroEmoji, emojis.length === 1 && styles.heroEmojiSolo, i === 1 && styles.heroEmojiB]}
          >
            {e}
          </Text>
        ))}
      </Animated.View>
    </LinearGradient>
  );
};

/** Rounded text field in the same style as the rest of the flow. */
const Field = React.forwardRef<RNTextInput, React.ComponentProps<typeof TextInput> & {
  right?: React.ReactNode; flex?: boolean; invalid?: boolean;
}>(({ right, flex, invalid, style, ...rest }, ref) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused, invalid && styles.fieldInvalid, flex && { flex: 1 }]}>
      <TextInput
        ref={ref}
        placeholderTextColor={COLORS.gray}
        style={[styles.fieldInput, style]}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        {...rest}
      />
      {right}
    </View>
  );
});

const SignupScreen = ({ navigation }: Props) => {
  const { register, isAuthenticated } = useAuth();
  const { addPet, refresh: refreshPets } = usePets();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const dir = useRef<1 | -1>(1);

  // About you
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  // Pet
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<PetType | null>(null);
  const [breed, setBreed] = useState('');
  const [ageIdx, setAgeIdx] = useState<number | null>(null);
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [skippedPet, setSkippedPet] = useState(false);
  // Account
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [ageOpen, setAgeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');

  const ddRef = useRef<RNTextInput>(null);
  const mmRef = useRef<RNTextInput>(null);
  const lastRef = useRef<RNTextInput>(null);
  const emailRef = useRef<RNTextInput>(null);
  const pwdRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(1)).current;

  const petFirst = petName.trim();
  const petEmoji = PET_TYPES.find((t) => t.value === petType)?.emoji ?? '';
  const birthYear = ageIdx == null ? null : new Date().getFullYear() - AGE_OPTIONS[ageIdx].years;

  // ── Birthday (optional): both DD and MM, a real calendar date, not in the future ──
  const birth = useMemo(() => {
    if (!dd && !mm) return { state: 'empty' as const, iso: null as string | null };
    if (!dd || !mm || birthYear == null) return { state: 'invalid' as const, iso: null };
    const d = Number(dd), m = Number(mm);
    const date = new Date(birthYear, m - 1, d);
    const real = date.getFullYear() === birthYear && date.getMonth() === m - 1 && date.getDate() === d;
    if (!real || date.getTime() > Date.now()) return { state: 'invalid' as const, iso: null };
    const pad = (n: number) => String(n).padStart(2, '0');
    return { state: 'ok' as const, iso: `${birthYear}-${pad(m)}-${pad(d)}` };
  }, [dd, mm, birthYear]);

  const pwdOk = password.length >= 6;
  const canContinue: Record<StepKey, boolean> = {
    about: firstName.trim().length > 0 && lastName.trim().length > 0 && EMAIL_RE.test(email.trim()),
    petName: petFirst.length > 0,
    petType: petType != null,
    breed: breed.trim().length > 0,
    age: ageIdx != null && birth.state !== 'invalid',
    account: pwdOk && password === confirm,
  };
  const ok = canContinue[step] && !submitting;

  const go = useCallback((to: number) => {
    dir.current = to > stepIdx ? 1 : -1;
    setError('');
    setStepIdx(to);
  }, [stepIdx]);

  // Slide/fade the step content in whenever the step changes.
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [stepIdx, enter]);

  const back = useCallback(() => {
    if (submitting) return true;
    if (stepIdx === 0) { navigation.goBack(); return true; }
    // After skipping the pet questions, "back" from the password step returns to step 1.
    go(step === 'account' && skippedPet ? 1 : stepIdx - 1);
    return true;
  }, [stepIdx, step, skippedPet, submitting, go, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  // Close the auth modal only once the account AND pet have been saved.
  useEffect(() => {
    if (finished && isAuthenticated && navigation.canGoBack()) navigation.goBack();
  }, [finished, isAuthenticated, navigation]);

  const doShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
  };

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`;
      await register(name, email.trim(), password, phone.trim() || undefined);
      // The account exists now. A pet hiccup must not lose the signup — it can be added later.
      if (!skippedPet && petType) {
        const ageYears = ageIdx == null ? null : AGE_OPTIONS[ageIdx].years || 0.5;
        try {
          await addPet({
            name: petFirst, type: petType, breed: breed.trim(),
            age_years: ageYears, birth_date: birth.iso,
          });
        } catch { /* ignore — see above */ }
        await refreshPets();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFinished(true);
    } catch (err) {
      const msg = (err as Error).message || 'Could not create your account.';
      // Email taken → send them back to the step that holds the email (go() clears the
      // error, so set the message afterwards).
      if (/already registered/i.test(msg)) go(0);
      setError(/already registered/i.test(msg) ? 'This email is already registered. Use a different email or sign in.' : msg);
      doShake();
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (!ok) { doShake(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step === 'account') { submit(); return; }
    if (step === 'age') { go(stepIdx + 1); return; }
    go(stepIdx + 1);
  };

  const skipPet = () => { setSkippedPet(true); go(STEPS.indexOf('account')); };

  // ── Titles ──
  const hl = (t: string) => <Text style={styles.hl}>{t}</Text>;
  const title = (() => {
    switch (step) {
      case 'about':   return <Text style={styles.title}>Welcome to MedPet</Text>;
      case 'petName': return <Text style={styles.title}>Let's meet your pet</Text>;
      case 'petType': return <Text style={styles.title}>What kind of pet is {hl(petFirst)}?</Text>;
      case 'breed':   return <Text style={styles.title}>What breed is {hl(petFirst)}?</Text>;
      case 'age':     return <Text style={styles.title}>How old is {hl(`${petFirst}'s`)}?</Text>;
      case 'account': return <Text style={styles.title}>Almost there!</Text>;
    }
  })();
  const subtitle: Record<StepKey, string> = {
    about: 'Ready to get you onboard!',
    petName: 'We personalize everything for them',
    petType: "Choose who's in charge",
    breed: 'Helps us suggest the right food, care, and medicines',
    age: 'We promise to make it extra special',
    account: 'Create a password to keep your account safe',
  };

  const heroFlexMin = Math.min(120, height * 0.14);
  const sheetMin = Math.min(height * 0.5, 440);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.heroWrap, { minHeight: heroFlexMin }]}>
        <Hero step={step} petEmoji={petEmoji} />
        <PressableScale
          onPress={back}
          style={[styles.backBtn, { top: insets.top + 10 }]}
          scaleTo={0.88}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.black} />
        </PressableScale>
      </View>

      <View style={[styles.sheet, { minHeight: sheetMin, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={{
              opacity: enter,
              transform: [
                { translateX: Animated.add(shake, enter.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 28, 0] })) },
              ],
            }}
          >
            {title}
            <Text style={styles.subtitle}>{subtitle[step]}</Text>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={COLORS.errorDark} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* ── 1 · About you ── */}
            {step === 'about' && (
              <View style={styles.body}>
                <View style={styles.row}>
                  <Field
                    flex value={firstName} onChangeText={setFirstName} placeholder="First Name *"
                    autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => lastRef.current?.focus()}
                    accessibilityLabel="First name"
                  />
                  <Field
                    ref={lastRef} flex value={lastName} onChangeText={setLastName} placeholder="Last Name *"
                    autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()}
                    accessibilityLabel="Last name"
                  />
                </View>
                <Field
                  ref={emailRef} value={email} onChangeText={setEmail} placeholder="Email ID *"
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  returnKeyType="done" onSubmitEditing={next}
                  invalid={email.length > 0 && !EMAIL_RE.test(email.trim())}
                  accessibilityLabel="Email"
                />
                {email.length > 0 && !EMAIL_RE.test(email.trim()) && (
                  <Text style={styles.hint}>Enter a valid email address.</Text>
                )}
              </View>
            )}

            {/* ── 2 · Pet's name ── */}
            {step === 'petName' && (
              <View style={styles.body}>
                <Field
                  value={petName} onChangeText={setPetName} placeholder="Pet's name *"
                  autoCapitalize="words" maxLength={80} returnKeyType="done" onSubmitEditing={next}
                  accessibilityLabel="Pet name"
                />
                <Text style={styles.note}>Have more pets? Add them in your account</Text>
                <TouchableOpacity onPress={skipPet} style={styles.skip} hitSlop={8}>
                  <Text style={styles.skipText}>I don't have a pet yet</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── 3 · Kind of pet ── */}
            {step === 'petType' && (
              <View style={styles.body}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
                  {PET_TYPES.map((t) => {
                    const active = petType === t.value;
                    return (
                      <PressableScale
                        key={t.value}
                        onPress={() => setPetType(t.value)}
                        style={[styles.tile, active && styles.tileActive]}
                        scaleTo={0.93}
                      >
                        <View style={styles.tileBubble}>
                          <Text style={styles.tileEmoji} allowFontScaling={false}>{t.emoji}</Text>
                        </View>
                        <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>{t.label}</Text>
                        {active && (
                          <View style={styles.tick}><Ionicons name="checkmark" size={12} color={COLORS.white} /></View>
                        )}
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── 4 · Breed (free text) ── */}
            {step === 'breed' && (
              <View style={styles.body}>
                <Field
                  value={breed} onChangeText={setBreed} placeholder="Enter breed (e.g. Labrador)"
                  autoCapitalize="words" maxLength={80} returnKeyType="done" onSubmitEditing={next}
                  accessibilityLabel="Breed"
                />
                <Text style={styles.hint}>Not sure? A mix or "Indie" works too.</Text>
              </View>
            )}

            {/* ── 5 · Age + approximate birthday ── */}
            {step === 'age' && (
              <View style={styles.body}>
                <Pressable
                  onPress={() => setAgeOpen(true)}
                  style={[styles.field, styles.select, ageIdx != null && styles.fieldFocused]}
                  accessibilityRole="button"
                  accessibilityLabel="Select age"
                >
                  <View style={{ flex: 1 }}>
                    {ageIdx != null && <Text style={styles.floatLabel}>Select age</Text>}
                    <Text style={[styles.selectValue, ageIdx == null && { color: COLORS.gray, fontWeight: '500' }]}>
                      {ageIdx == null ? 'Select age' : AGE_OPTIONS[ageIdx].label}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={COLORS.black} />
                </Pressable>

                {ageIdx != null && (
                  <>
                    <Text style={styles.note}>That makes {hl(`${petFirst}'s`)} birthday around</Text>
                    <View style={[styles.field, styles.dateField, birth.state === 'ok' && styles.fieldFocused, birth.state === 'invalid' && styles.fieldInvalid]}>
                      <TextInput
                        ref={ddRef} value={dd} placeholder="DD" placeholderTextColor={COLORS.gray}
                        onChangeText={(t) => { const v = digits(t).slice(0, 2); setDd(v); if (v.length === 2) mmRef.current?.focus(); }}
                        keyboardType="number-pad" maxLength={2} style={styles.dateInput} accessibilityLabel="Birth day"
                      />
                      <Text style={styles.slash}>/</Text>
                      <TextInput
                        ref={mmRef} value={mm} placeholder="MM" placeholderTextColor={COLORS.gray}
                        onChangeText={(t) => setMm(digits(t).slice(0, 2))}
                        onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && mm === '') ddRef.current?.focus(); }}
                        keyboardType="number-pad" maxLength={2} style={styles.dateInput} accessibilityLabel="Birth month"
                      />
                      <Text style={styles.slash}>/</Text>
                      <Text style={styles.year}>{birthYear}</Text>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity onPress={() => ddRef.current?.focus()} hitSlop={10} accessibilityLabel="Enter birthday">
                        <Ionicons name="calendar-outline" size={20} color={COLORS.black} />
                      </TouchableOpacity>
                    </View>
                    {birth.state === 'invalid' ? (
                      <Text style={[styles.hint, { color: COLORS.errorDark }]}>
                        Enter a valid day and month (not in the future), or clear both to skip.
                      </Text>
                    ) : (
                      <Text style={styles.hint}>Optional — an approximate date is fine.</Text>
                    )}
                  </>
                )}
              </View>
            )}

            {/* ── 6 · Account security ── */}
            {step === 'account' && (
              <View style={styles.body}>
                <Field
                  value={phone} onChangeText={setPhone} placeholder="Phone (optional)"
                  keyboardType="phone-pad" returnKeyType="next" onSubmitEditing={() => pwdRef.current?.focus()}
                  accessibilityLabel="Phone"
                />
                <Field
                  ref={pwdRef} value={password} onChangeText={setPassword} placeholder="Password * (min 6 characters)"
                  secureTextEntry={!showPwd} autoCapitalize="none" returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  invalid={password.length > 0 && !pwdOk}
                  accessibilityLabel="Password"
                  right={(
                    <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={10} accessibilityLabel="Show password">
                      <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
                    </TouchableOpacity>
                  )}
                />
                <Field
                  ref={confirmRef} value={confirm} onChangeText={setConfirm} placeholder="Confirm password *"
                  secureTextEntry={!showPwd} autoCapitalize="none" returnKeyType="done" onSubmitEditing={next}
                  invalid={confirm.length > 0 && confirm !== password}
                  accessibilityLabel="Confirm password"
                />
                {confirm.length > 0 && confirm !== password && (
                  <Text style={[styles.hint, { color: COLORS.errorDark }]}>Passwords don't match.</Text>
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {step === 'about' && (
            <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.signIn} hitSlop={8}>
              <Text style={styles.signInText}>Already have an account? <Text style={styles.signInLink}>Sign in</Text></Text>
            </TouchableOpacity>
          )}
          <PressableScale onPress={next} disabled={submitting} haptic={false} scaleTo={ok ? 0.97 : 1} accessibilityLabel="Continue">
            {ok ? (
              <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.cta, SHADOWS.floating]}>
                {submitting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.ctaText}>{step === 'account' ? 'Create account' : 'Continue'}</Text>}
              </LinearGradient>
            ) : (
              <View style={[styles.cta, styles.ctaOff]}>
                {submitting
                  ? <ActivityIndicator color={COLORS.gray} />
                  : <Text style={[styles.ctaText, { color: COLORS.gray }]}>{step === 'account' ? 'Create account' : 'Continue'}</Text>}
              </View>
            )}
          </PressableScale>
        </View>
      </View>

      {/* Age picker */}
      <Modal visible={ageOpen} transparent animationType="fade" onRequestClose={() => setAgeOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAgeOpen(false)}>
          <Pressable style={[styles.modalCard, { maxHeight: height * 0.6 }]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select age</Text>
            <FlatList
              data={AGE_OPTIONS}
              keyExtractor={(a) => a.label}
              showsVerticalScrollIndicator={false}
              initialScrollIndex={ageIdx ?? 0}
              getItemLayout={(_, i) => ({ length: 52, offset: 52 * i, index: i })}
              renderItem={({ item, index }) => {
                const active = index === ageIdx;
                return (
                  <TouchableOpacity
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      setAgeIdx(index);
                      // the year changes with the age, so a previously typed day/month needs re-checking
                      setAgeOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.label}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  // hero
  heroWrap: { flex: 1, flexShrink: 1, minHeight: 0 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)' },
  heroArt: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, paddingBottom: 28 },
  heroEmoji: { fontSize: 84 },
  heroEmojiSolo: { fontSize: 128 },
  heroEmojiB: { fontSize: 100, marginBottom: -6 },
  backBtn: {
    position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOWS.card,
  },

  // bottom sheet
  sheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: RADII.xl, borderTopRightRadius: RADII.xl,
    marginTop: -26, paddingTop: 22, paddingHorizontal: 20, flexShrink: 1,
    shadowColor: '#0F2A22', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 10,
  },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetContent: { paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.black, lineHeight: 28 },
  hl: { color: COLORS.primary },
  subtitle: { fontSize: 14, color: COLORS.gray, marginTop: 4, lineHeight: 20 },
  body: { marginTop: 20, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  hint: { fontSize: 12, color: COLORS.gray, marginTop: -2, lineHeight: 17 },
  note: { fontSize: 13, color: COLORS.gray, lineHeight: 19, marginTop: 2 },
  skip: { alignSelf: 'flex-start', paddingVertical: 4 },
  skipText: { fontSize: 13, fontWeight: '700', color: COLORS.primaryDark, textDecorationLine: 'underline' },

  // inputs
  field: {
    flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: RADII.md,
    borderWidth: 1.5, borderColor: COLORS.grayBorder, backgroundColor: '#F7FAF9', paddingHorizontal: 14,
  },
  fieldFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  fieldInvalid: { borderColor: COLORS.errorDark },
  fieldInput: { flex: 1, fontSize: 15, color: COLORS.black, paddingVertical: 12 },
  select: { paddingVertical: 8 },
  floatLabel: { fontSize: 11, fontWeight: '600', color: COLORS.gray },
  selectValue: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  dateField: { gap: 2 },
  dateInput: { minWidth: 30, fontSize: 16, fontWeight: '700', color: COLORS.black, paddingVertical: 12, textAlign: 'center' },
  slash: { fontSize: 16, color: COLORS.gray },
  year: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginLeft: 2 },

  // pet type tiles
  tiles: { gap: 12, paddingVertical: 4, paddingRight: 20 },
  tile: {
    width: 104, borderRadius: RADII.md, paddingVertical: 14, alignItems: 'center', gap: 8,
    backgroundColor: '#F1F5F4', borderWidth: 2, borderColor: 'transparent',
  },
  tileActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  tileBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 34 },
  tileLabel: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  tileLabelActive: { color: COLORS.primaryDark },
  tick: {
    position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },

  // errors
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2',
    borderRadius: RADII.sm, padding: 12, marginTop: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: COLORS.errorDark, fontWeight: '600', lineHeight: 18 },

  // footer
  footer: { paddingTop: 10, gap: 10 },
  signIn: { alignSelf: 'center', paddingVertical: 2 },
  signInText: { fontSize: 13, color: COLORS.black },
  signInLink: { fontWeight: '800', color: COLORS.primaryDark, textDecorationLine: 'underline' },
  cta: { height: 56, borderRadius: RADII.md, alignItems: 'center', justifyContent: 'center' },
  ctaOff: { backgroundColor: '#E5E7EB' },
  ctaText: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  // age picker
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,42,34,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: RADII.lg, paddingVertical: 12, ...SHADOWS.floating },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black, paddingHorizontal: 20, paddingBottom: 8 },
  option: { height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionActive: { backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 15, color: COLORS.black, fontWeight: '500' },
  optionTextActive: { fontWeight: '800', color: COLORS.primaryDark },
});

export default SignupScreen;
