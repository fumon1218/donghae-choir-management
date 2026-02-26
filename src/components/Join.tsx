import { useState, FormEvent } from 'react';
import { Part, Member } from '../data';
import { Music, User, CheckCircle, ArrowRight } from 'lucide-react';

export default function Join() {
  const [name, setName] = useState('');
  const [part, setPart] = useState<Part>('Soprano');
  const [isJoined, setIsJoined] = useState(false);

  const parts: Part[] = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    const newMember: Member = {
      id: `extra-${Date.now()}`,
      name,
      part,
    };

    const savedMembers = localStorage.getItem('choir_extra_members');
    const extraMembers = savedMembers ? JSON.parse(savedMembers) : [];
    localStorage.setItem('choir_extra_members', JSON.stringify([...extraMembers, newMember]));
    
    setIsJoined(true);
  };

  if (isJoined) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
              <CheckCircle className="w-12 h-12" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">가입 완료!</h2>
          <p className="mt-4 text-gray-600">
            {name}님, 동해교회 찬양대원이 되신 것을 환영합니다.<br />
            이제 지휘자님이 출석부에서 확인하실 수 있습니다.
          </p>
          <div className="mt-8">
            <button
              onClick={() => window.location.href = window.location.origin}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg"
            >
              메인 화면으로 가기
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img 
            src="https://ais-pre-lmlcnppibbail3xnbi3fpl-88483622903.asia-east1.run.app/logo.png" 
            alt="Dong-Hae Church Choir Logo" 
            className="w-24 h-24 object-contain"
            onError={(e) => {
              // Fallback if image not found
              e.currentTarget.src = 'https://picsum.photos/seed/choir/200/200';
            }}
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          동해교회 찬양대 가입하기
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          초대 링크를 통해 가입 페이지에 접속하셨습니다.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-gray-100 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                이름
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="본인의 이름을 입력하세요"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                파트 선택
              </label>
              <div className="grid grid-cols-2 gap-3">
                {parts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPart(p)}
                    className={`
                      py-3 px-4 text-sm font-medium rounded-xl border transition-all
                      ${part === p 
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }
                    `}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                가입 신청하기
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
