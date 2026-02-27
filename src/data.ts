export type Part = 'Soprano' | 'Alto' | 'Tenor' | 'Bass' | 'Orchestra';

export interface Member {
  id: string;
  name: string;
  part: Part;
  role?: string;
  imageUrl?: string;
}

export const members: Member[] = [];

export interface BoardCategory {
  id: string;
  name: string;
  description: string;
  order: number;
}

export interface BoardPost {
  id: string;
  boardId: string;
  author: string;
  authorUid: string;
  content: string;
  imageUrl?: string;
  youtubeUrl?: string;
  createdAt: number;
}

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
