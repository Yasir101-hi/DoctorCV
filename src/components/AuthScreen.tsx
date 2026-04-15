import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  GoogleAuthProvider, 
  signInWithPopup, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2, FileCode2, CheckCircle2, Stethoscope, Plus, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [validationErrors, setValidationErrors] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear specific validation error when user types
    setValidationErrors({ ...validationErrors, [e.target.name]: '' });
    setError('');
  };

  const validateForm = () => {
    let isValid = true;
    const errors = { fullName: '', email: '', password: '', confirmPassword: '' };

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (!isLogin) {
      const hasLetter = /[a-zA-Z]/.test(formData.password);
      const hasNumber = /[0-9]/.test(formData.password);
      if (formData.password.length < 8 || !hasLetter || !hasNumber) {
        errors.password = 'Password must be at least 8 characters and contain both letters and numbers';
        isValid = false;
      }
    }

    if (!isLogin) {
      // Full Name validation
      if (!formData.fullName.trim()) {
        errors.fullName = 'Full name is required';
        isValid = false;
      }
      
      // Confirm Password validation
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
        isValid = false;
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        // App.tsx onAuthStateChanged will handle the redirect
      } else {
        const result = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(result.user, { displayName: formData.fullName });
        
        // Save user to Firestore
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          displayName: formData.fullName,
          createdAt: new Date().toISOString()
        }, { merge: true });

        setSuccessMsg('Account created successfully! Logging you in...');
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      // Format Firebase error messages
      let errorMessage = "Authentication failed. Please try again.";
      if (err.code === 'auth/email-already-in-use') errorMessage = "This email is already registered.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') errorMessage = "Invalid email or password.";
      if (err.code === 'auth/user-not-found') errorMessage = "No account found with this email.";
      if (err.code === 'auth/operation-not-allowed') errorMessage = "Email/Password sign-in is not enabled in Firebase Console.";
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      
      // Check if user exists in Firestore, if not create them
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err: any) {
      console.error("Google login failed:", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setValidationErrors({ ...validationErrors, email: 'Please enter your email to reset password' });
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setSuccessMsg('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const Logo = ({ isDark = false }: { isDark?: boolean }) => (
    <div className="flex items-center gap-3 drop-shadow-md">
      {/* Custom Logo Icon */}
      <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
        {/* Document/Clipboard */}
        <div className={`absolute inset-1 ${isDark ? 'bg-white/10 border-white/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'} rounded-lg shadow-md border-2 flex flex-col items-center pt-1.5 z-10 transition-colors`}>
          <div className="w-4 h-4 text-green-500 mb-0.5">
            <Plus className="w-full h-full" strokeWidth={4} />
          </div>
          <div className={`w-6 h-0.5 ${isDark ? 'bg-white/40' : 'bg-slate-200 dark:bg-slate-500'} mb-1 rounded-full transition-colors`}></div>
          <div className={`w-6 h-0.5 ${isDark ? 'bg-white/40' : 'bg-slate-200 dark:bg-slate-500'} mb-1 rounded-full transition-colors`}></div>
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" strokeWidth={2.5} />
        </div>
        
        {/* Stethoscope Wrapping */}
        <Stethoscope className={`w-16 h-16 ${isDark ? 'text-white' : 'text-blue-600 dark:text-blue-500'} absolute -bottom-2 -left-2 z-20 drop-shadow-md`} strokeWidth={1.5} />
        
        {/* Magnifying Glass with Plus */}
        <div className={`absolute -bottom-1 -right-2 ${isDark ? 'bg-white/20 border-white/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'} rounded-full p-0.5 shadow-md border z-30`}>
          <div className={`bg-green-500 rounded-full p-1 flex items-center justify-center border-2 ${isDark ? 'border-transparent' : 'border-blue-600 dark:border-blue-500'}`}>
            <Plus className="w-3 h-3 text-white" strokeWidth={4} />
          </div>
        </div>
      </div>
      
      {/* Logo Text */}
      <h1 className="flex flex-col leading-none">
        <span className={`text-3xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-blue-600 dark:text-blue-500'} uppercase`}>CV</span>
        <span className={`text-2xl font-bold tracking-tight ${isDark ? 'text-green-300' : 'text-green-500 dark:text-green-400'} -mt-1`}>Doctor</span>
      </h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Left Side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-green-500 p-12 flex-col justify-between relative overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 right-0 w-64 h-64 bg-green-400/20 rounded-full blur-3xl transform translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
        
        <div className="relative z-10">
          <Logo isDark={true} />
        </div>
        
        <div className="relative z-10 text-white mb-12">
          <h2 className="text-4xl font-bold mb-6 leading-tight">Elevate Your Career with<br/>AI-Powered CV Analysis</h2>
          <p className="text-blue-50 text-lg max-w-md leading-relaxed mb-8">
            Stop guessing what ATS systems want. Get a deep, McKinsey-level evaluation of your resume, discover missing keywords, and generate a tailored cover letter in seconds.
          </p>

          {/* Mini App Preview / Visual Explanation */}
          <div className="relative w-full max-w-md">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-100" />
                  </div>
                  <div>
                    <div className="h-2 w-24 bg-white/30 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-white/20 rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1.5 rounded-full border border-green-500/30">
                  <CheckCircle2 className="w-4 h-4 text-green-300" />
                  <span className="text-xs font-medium text-green-100">ATS Optimized</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-2 w-full bg-white/20 rounded-full"></div>
                <div className="h-2 w-5/6 bg-white/20 rounded-full"></div>
                <div className="h-2 w-4/6 bg-white/20 rounded-full"></div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                 <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-center text-center">
                   <div className="text-3xl font-bold text-white mb-1">92<span className="text-lg text-green-300">%</span></div>
                   <div className="text-xs text-blue-100 uppercase tracking-wider font-semibold">Match Score</div>
                 </div>
                 <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-center text-center">
                   <div className="text-3xl font-bold text-white mb-1">+15</div>
                   <div className="text-xs text-blue-100 uppercase tracking-wider font-semibold">Keywords Found</div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Subtle Background Pattern for Right Side */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-green-500/5 dark:bg-green-500/10 blur-3xl"></div>
        </div>

        {/* Mobile Logo (visible only on small screens) */}
        <div className="lg:hidden mb-8 relative z-10">
          <Logo />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-8 pb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {isLogin ? 'Welcome back' : 'Create an account'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isLogin 
                  ? 'Enter your details to access your ATS Analyzer account.' 
                  : 'Sign up to analyze your CV and generate cover letters.'}
              </p>
            </div>

          {/* Form */}
          <div className="px-8 pb-8">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </motion.div>
              )}
              
              {successMsg && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-start gap-3 text-emerald-600 dark:text-emerald-400 text-sm"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{successMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1"
                  >
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                    <div className="relative">
                      <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className={`w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border ${validationErrors.fullName ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'} rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                      />
                    </div>
                    {validationErrors.fullName && <p className="text-rose-500 text-xs mt-1">{validationErrors.fullName}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className={`w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border ${validationErrors.email ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'} rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                  />
                </div>
                {validationErrors.email && <p className="text-rose-500 text-xs mt-1">{validationErrors.email}</p>}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                  {isLogin && (
                    <button type="button" onClick={handleForgotPassword} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-slate-800/50 border ${validationErrors.password ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'} rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {validationErrors.password && <p className="text-rose-500 text-xs mt-1">{validationErrors.password}</p>}
              </div>

              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1"
                  >
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className={`w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-slate-800/50 border ${validationErrors.confirmPassword ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'} rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                      />
                    </div>
                    {validationErrors.confirmPassword && <p className="text-rose-500 text-xs mt-1">{validationErrors.confirmPassword}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {isLogin && (
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="remember" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400">Remember me</label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-6"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-slate-900 text-slate-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="mt-6 w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-6 py-3.5 rounded-xl font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </div>
          
          {/* Footer */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setValidationErrors({ fullName: '', email: '', password: '', confirmPassword: '' });
                }} 
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  </div>
  );
}
