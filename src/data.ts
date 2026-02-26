export type Part = 'Soprano' | 'Alto' | 'Tenor' | 'Bass' | 'Orchestra';

export interface Member {
  id: string;
  name: string;
  part: Part;
  role?: string;
}

export const members: Member[] = [
  // Soprano (12)
  { id: 's1', name: '김소프', part: 'Soprano', role: '파트장' },
  { id: 's2', name: '이은혜', part: 'Soprano' },
  { id: 's3', name: '박사랑', part: 'Soprano' },
  { id: 's4', name: '최믿음', part: 'Soprano' },
  { id: 's5', name: '정소망', part: 'Soprano' },
  { id: 's6', name: '강평안', part: 'Soprano' },
  { id: 's7', name: '조기쁨', part: 'Soprano' },
  { id: 's8', name: '윤온유', part: 'Soprano' },
  { id: 's9', name: '장충성', part: 'Soprano' },
  { id: 's10', name: '임진실', part: 'Soprano' },
  { id: 's11', name: '한지혜', part: 'Soprano' },
  { id: 's12', name: '오찬양', part: 'Soprano' },
  // Alto (10)
  { id: 'a1', name: '김알토', part: 'Alto', role: '파트장' },
  { id: 'a2', name: '이화평', part: 'Alto' },
  { id: 'a3', name: '박자비', part: 'Alto' },
  { id: 'a4', name: '최양선', part: 'Alto' },
  { id: 'a5', name: '정겸손', part: 'Alto' },
  { id: 'a6', name: '강인내', part: 'Alto' },
  { id: 'a7', name: '조절제', part: 'Alto' },
  { id: 'a8', name: '윤순종', part: 'Alto' },
  { id: 'a9', name: '장감사', part: 'Alto' },
  { id: 'a10', name: '임영광', part: 'Alto' },
  // Tenor (9)
  { id: 't1', name: '김테너', part: 'Tenor', role: '파트장' },
  { id: 't2', name: '이거룩', part: 'Tenor' },
  { id: 't3', name: '박성결', part: 'Tenor' },
  { id: 't4', name: '최진리', part: 'Tenor' },
  { id: 't5', name: '정생명', part: 'Tenor' },
  { id: 't6', name: '강빛', part: 'Tenor' },
  { id: 't7', name: '조소금', part: 'Tenor' },
  { id: 't8', name: '윤반석', part: 'Tenor' },
  { id: 't9', name: '장구원', part: 'Tenor' },
  // Bass (10)
  { id: 'b1', name: '김베이스', part: 'Bass', role: '파트장' },
  { id: 'b2', name: '이능력', part: 'Bass' },
  { id: 'b3', name: '박권능', part: 'Bass' },
  { id: 'b4', name: '최승리', part: 'Bass' },
  { id: 'b5', name: '정영생', part: 'Bass' },
  { id: 'b6', name: '강천국', part: 'Bass' },
  { id: 'b7', name: '조보혈', part: 'Bass' },
  { id: 'b8', name: '윤십자가', part: 'Bass' },
  { id: 'b9', name: '장부활', part: 'Bass' },
  { id: 'b10', name: '임재림', part: 'Bass' },
  // Orchestra (8)
  { id: 'o1', name: '김바이올린', part: 'Orchestra', role: '악장' },
  { id: 'o2', name: '이첼로', part: 'Orchestra' },
  { id: 'o3', name: '박플룻', part: 'Orchestra' },
  { id: 'o4', name: '최클라리넷', part: 'Orchestra' },
  { id: 'o5', name: '정트럼펫', part: 'Orchestra' },
  { id: 'o6', name: '강팀파니', part: 'Orchestra' },
  { id: 'o7', name: '조피아노', part: 'Orchestra', role: '반주자' },
  { id: 'o8', name: '윤오르간', part: 'Orchestra', role: '반주자' },
];

export interface Hymn {
  month: number;
  week: number;
  title: string;
  composer: string;
  scoreUrl?: string;
}

export const hymns: Hymn[] = [
  { month: 1, week: 1, title: '시온의 영광이 빛나는 아침', composer: 'L. Mason' },
  { month: 1, week: 2, title: '내 영혼이 은총 입어', composer: 'J.M. Black' },
  { month: 1, week: 3, title: '주 하나님 지으신 모든 세계', composer: 'Swedish Folk Melody' },
  { month: 1, week: 4, title: '참 아름다워라', composer: 'F.L. Sheppard' },
  { month: 2, week: 1, title: '만유의 주재', composer: 'Silesian Folk Melody' },
  { month: 2, week: 2, title: '빛의 사자들', composer: 'H.S. Perkins' },
  { month: 2, week: 3, title: '내 모든 소원 기도의 제목', composer: 'H.D. Loes' },
  { month: 2, week: 4, title: '구주와 함께 나 죽었으니', composer: 'D.W. Whittle' },
  { month: 3, week: 1, title: '예수 부활했으니', composer: 'Lyra Davidica' },
  { month: 3, week: 2, title: '무덤에 머물러', composer: 'R. Lowry' },
  { month: 3, week: 3, title: '할렐루야 우리 예수', composer: 'P.P. Bliss' },
  { month: 3, week: 4, title: '주님께 영광', composer: 'G.F. Handel' },
  { month: 4, week: 1, title: '내 주를 가까이 하게 함은', composer: 'L. Mason' },
  { month: 4, week: 2, title: '주 예수보다 더 귀한 것은 없네', composer: 'G.B. Shea' },
  { month: 4, week: 3, title: '나 같은 죄인 살리신', composer: 'Traditional American Melody' },
  { month: 4, week: 4, title: '주의 친절한 팔에 안기세', composer: 'A.J. Showalter' },
];

export interface Schedule {
  day: string;
  time: string;
  location: string;
  description: string;
}

export const schedules: Schedule[] = [
  { day: '주일 (일요일)', time: '09:00 - 10:30', location: '제1찬양대실', description: '주일 1부 예배 찬양 연습' },
  { day: '주일 (일요일)', time: '13:00 - 15:00', location: '본당', description: '오후 찬양 연습 및 파트 연습' },
  { day: '수요일', time: '19:00 - 21:00', location: '제1찬양대실', description: '수요 예배 찬양 및 정기 연습' },
  { day: '토요일', time: '10:00 - 12:00', location: '관현악실', description: '관현악부 특별 연습' },
];
