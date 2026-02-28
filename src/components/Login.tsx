import { useState, FormEvent } from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Lock, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import logoUrl from '../assets/logo.jpg';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Only for signup
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Common function to register a new user in Firestore
  const ensureUserInFirestore = async (uid: string, userEmail: string | null, userName: string | null, photoURL: string | null) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap: any = await Promise.race([
        getDoc(userRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('firestore_timeout')), 4000))
      ]);
      if (!userSnap.exists()) {
        await Promise.race([
          setDoc(userRef, {
            name: userName || '이름 없음',
            email: userEmail || '',
            photoURL: photoURL || '',
            role: '대기권한',
            createdAt: new Date()
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('firestore_timeout')), 4000))
        ]);
      }
    } catch (err) {
      console.warn('Firestore connection slow, skipping ensureUserInFirestore block to unfreeze UI:', err);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // 아이디를 내부 이메일 형식으로 변환 (도메인이 없으면 @donghae.church 추가)
    const processedEmail = email.includes('@') ? email : `${email}@donghae.church`;

    try {
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error('이름을 입력해주세요.');
        }
        const result: any = await Promise.race([
          createUserWithEmailAndPassword(auth, processedEmail, password),
          new Promise((_, reject) => setTimeout(() => reject(new Error('auth_timeout')), 8000))
        ]);
        await ensureUserInFirestore(result.user.uid, result.user.email, name, null);
      } else {
        await Promise.race([
          signInWithEmailAndPassword(auth, processedEmail, password),
          new Promise((_, reject) => setTimeout(() => reject(new Error('auth_timeout')), 8000))
        ]);
      }
      onLogin();
    } catch (err: any) {
      console.error('Email auth error:', err);
      if (err.message === '이름을 입력해주세요.') {
        setError(err.message);
      } else if (err.message === 'auth_timeout') {
        setError('서버 응답이 지연되고 있습니다. 네트워크 상태를 확인하시거나 잠시 후 다시 시도해주세요.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-email') {
        setError('아이디 또는 비밀번호가 일치하지 않습니다.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 아이디입니다.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호는 6자리 이상이어야 합니다.');
      } else {
        setError('로그인/가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserInFirestore(result.user.uid, result.user.email, result.user.displayName, result.user.photoURL);
      onLogin();
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked') {
        setError('팝업이 차단되었거나 창이 닫혔습니다. [설정]에서 팝업 차단을 해제하거나 아이디로 로그인해주세요.');
      } else {
        setError('구글 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img
            src={logoUrl}
            alt="Dong-Hae Church Choir Logo"
            className="w-24 h-24 object-contain"
            onError={(e) => {
              e.currentTarget.src = 'https://picsum.photos/seed/choir/200/200';
            }}
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 leading-tight">
          동해교회 찬양대
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isSignUp ? '새로운 계정을 만들고 가입 신청을 하세요' : '계정에 로그인하여 찬양대 관리를 시작하세요'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-gray-100 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleEmailAuth}>
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  이름 (실명)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={isSignUp}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="홍길동"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                아이디 {isSignUp && '(6자리 이상 권장)'}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="아이디 입력"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 animate-in fade-in slide-in-from-top-1">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed scale-95' : 'hover:scale-[1.02] active:scale-95'}`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (isSignUp ? '가입 신청하기' : '로그인')}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-4 bg-white text-gray-400 font-medium">소셜 계정 로그인</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className={`w-full flex items-center justify-center py-3 px-4 border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300 active:bg-gray-100'}`}
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google logo"
                  className="w-5 h-5 mr-3"
                />
                Google 계정으로 {isSignUp ? '가입' : '로그인'}
              </button>
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors p-2 hover:bg-blue-50 rounded-lg"
              >
                {isSignUp ? '이미 계정이 있으신가요? 로그인하기' : '계정이 없으신가요? 아이디로 가입하기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
