import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Dimensions, KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import type { RegisterForm as RegForm } from '../types/auth.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Signup'> };

const { height } = Dimensions.get('window');

interface FieldConfig {
  label: string;
  field: keyof RegForm;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  keyboard?: KeyboardTypeOptions;
  secure?: boolean;
}

const FIELDS: FieldConfig[] = [
  { label: 'Full Name',        field: 'name',            icon: 'person-outline',      placeholder: 'John Doe',         keyboard: 'default' },
  { label: 'Email Address',    field: 'email',           icon: 'mail-outline',         placeholder: 'you@example.com',  keyboard: 'email-address' },
  { label: 'Phone (optional)', field: 'phone',           icon: 'call-outline',         placeholder: '+91 XXXXX XXXXX', keyboard: 'phone-pad' },
  { label: 'Password',         field: 'password',        icon: 'lock-closed-outline',  placeholder: 'Min 6 characters', secure: true },
  { label: 'Confirm Password', field: 'confirmPassword', icon: 'lock-open-outline',    placeholder: 'Repeat password',  secure: true },
];

const SignupScreen = ({ navigation }: Props) => {
  const { register, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<RegForm>({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  });
  const [showPwd,   setShowPwd]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');

  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, useNativeDriver: true, tension: 55, friction: 8 }),
    ]).start();
  }, []);

  // Once registered, dismiss the auth modal and return to whatever launched it.
  useEffect(() => {
    if (isAuthenticated && navigation.canGoBack()) navigation.goBack();
  }, [isAuthenticated, navigation]);

  const set = (field: keyof RegForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.');
      shake(); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      shake(); return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      shake(); return;
    }
    setIsLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password, form.phone.trim() || undefined);
    } catch (err) {
      setError((err as Error).message);
      shake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <View style={styles.decor} />
        <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.logoRow}>
          <Text style={styles.logoIcon}>🐾</Text>
          <Text style={styles.logoText}>MedPet</Text>
        </View>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.sub}>Join thousands of pet parents</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.card, {
          opacity: cardOpacity,
          transform: [{ translateY: cardY }, { translateX: shakeAnim }],
        }]}>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {FIELDS.map((f) => (
            <View key={f.field}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={styles.inputRow}>
                <Ionicons name={f.icon} size={20} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.gray}
                  value={form[f.field]}
                  onChangeText={set(f.field)}
                  keyboardType={f.keyboard ?? 'default'}
                  autoCapitalize={f.field === 'name' ? 'words' : 'none'}
                  secureTextEntry={f.secure ? !showPwd : false}
                />
                {f.field === 'password' && (
                  <TouchableOpacity onPress={() => setShowPwd((p) => !p)}>
                    <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity onPress={handleRegister} disabled={isLoading} activeOpacity={0.85} style={{ marginTop: 24 }}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {isLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnText}>Create Account</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    height: height * 0.30, justifyContent: 'flex-end',
    paddingBottom: 24, paddingHorizontal: 24, overflow: 'hidden',
  },
  decor: {
    position: 'absolute', top: -40, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  backBtn:  { position: 'absolute', top: 52, left: 20, padding: 4 },
  logoRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoIcon: { fontSize: 24, marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  title:    { fontSize: 28, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  sub:      { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  scroll:        { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1, shadowRadius: 24, elevation: 8,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  errorText:  { color: COLORS.error, fontSize: 13, flex: 1 },
  label:      { fontSize: 13, fontWeight: '600', color: COLORS.black, marginBottom: 6, marginTop: 12 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
    borderRadius: 14, backgroundColor: COLORS.grayLight, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input:     { height: 50, fontSize: 15, color: COLORS.black },
  btn: {
    height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnText:   { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  loginRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginText: { color: COLORS.gray, fontSize: 14 },
  loginLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});

export default SignupScreen;
