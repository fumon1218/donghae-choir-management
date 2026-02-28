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

export interface Comment {
  id: string;
  author: string;
  authorUid: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
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
  comments?: Comment[];
}

export interface Hymn {
  month: number;
  date: string;
  title: string;
  composer: string;
  scoreUrl?: string;
}

export const hymns: Hymn[] = [];

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
