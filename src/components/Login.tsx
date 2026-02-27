import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Music, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create initial user document if it's their first time logging in
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          role: '대기권한', // Default role for new signups
          createdAt: new Date()
        });
      }

      onLogin();
    } catch (err: any) {
      console.error('Google login error:', err);
      // Handle Firebase specific errors
      if (err.code === 'auth/popup-closed-by-user') {
        setError('로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else {
        setError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
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
            src="https://ais-pre-lmlcnppibbail3xnbi3fpl-88483622903.asia-east1.run.app/logo.png"
            alt="Dong-Hae Church Choir Logo"
            className="w-24 h-24 object-contain"
            onError={(e) => {
              e.currentTarget.src = 'https://picsum.photos/seed/choir/200/200';
            }}
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 leading-tight">
          동해교회 찬양대<br />
          <span className="text-xl font-bold text-blue-600">Choir Manager</span>
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Google 계정으로 로그인하여 계속하기
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-gray-100 sm:rounded-2xl sm:px-10">

          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className={`w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google logo"
                className="w-5 h-5 mr-3"
              />
              {isLoading ? '로그인 중...' : 'Google로 로그인'}
            </button>

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">주의사항</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500 text-center space-y-1">
              <p>본 앱은 사전 가입/승인된 찬양대원 전용입니다.</p>
              <p>최초 로그인 시 관리자의 권한 승인이 필요할 수 있습니다.</p>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-md bg-red-50 p-4">
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
        </div>
      </div>
    </div>
  );
}
