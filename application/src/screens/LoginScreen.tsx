import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

const { height } = Dimensions.get('window');

const LoginScreen = ({ navigation }: Props) => {
  const { login, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');

  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 8 }),
    ]).start();
  }, []);

  // Once signed in, dismiss the auth modal and return to whatever launched it.
  useEffect(() => {
    if (isAuthenticated && navigation.canGoBack()) navigation.goBack();
  }, [isAuthenticated, navigation]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10,  duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      setError('Enter your email above, then tap "Forgot Password?".');
      shake();
      return;
    }
    try {
      await authAPI.forgotPassword(email.trim());
      Alert.alert(
        'Check your email',
        'If that email is registered, we\'ve sent a link to reset your password.'
      );
    } catch (err) {
      Alert.alert('Something went wrong', (err as Error).message);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      shake();
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
      shake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <View style={styles.decor1} />
        <View style={styles.decor2} />
        {navigation.canGoBack() && (
          <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={26} color={COLORS.white} />
          </TouchableOpacity>
        )}
        <View style={styles.logoRow}>
          <Text style={styles.logoIcon}>🐾</Text>
          <Text style={styles.logoText}>MedPet</Text>
        </View>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.sub}>Sign in to care for your pets</Text>
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

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.gray}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.gray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
            />
            <TouchableOpacity onPress={() => setShowPwd((p) => !p)}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotBtn} onPress={handleForgot}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogin} disabled={isLoading} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {isLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnText}>Sign In</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>or</Text>
            <View style={styles.divLine} />
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    height: height * 0.32, justifyContent: 'flex-end',
    paddingBottom: 30, paddingHorizontal: 24, overflow: 'hidden',
  },
  decor1: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decor2: {
    position: 'absolute', top: 30, right: 80,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  closeBtn: { position: 'absolute', top: 52, right: 20, padding: 4, zIndex: 1 },
  logoRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  logoIcon: { fontSize: 28, marginRight: 8 },
  logoText: { fontSize: 22, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  title:    { fontSize: 30, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
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
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { color: COLORS.error, fontSize: 13, flex: 1 },
  label:    { fontSize: 13, fontWeight: '600', color: COLORS.black, marginBottom: 6, marginTop: 12 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
    borderRadius: 14, backgroundColor: COLORS.grayLight, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, height: 50, fontSize: 15, color: COLORS.black },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 8, marginBottom: 20 },
  forgotText:{ fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  btn: {
    height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnText:   { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  divider:   { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divLine:   { flex: 1, height: 1, backgroundColor: COLORS.grayBorder },
  divText:   { marginHorizontal: 12, color: COLORS.gray, fontSize: 13 },
  signupRow: { flexDirection: 'row', justifyContent: 'center' },
  signupText:{ color: COLORS.gray, fontSize: 14 },
  signupLink:{ color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});

export default LoginScreen;
