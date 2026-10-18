// 나의 하모니 player skins. Each skin is plain CSS values, so it works without any image.
// Optional pictures dropped into public/harmony/ are picked up automatically:
//   harmony/skins/<id>.webp|jpg   body texture (drawn over the skin's own colors)
//   harmony/covers/<book>.webp|jpg  default album cover of a book (grace, hymn, ensemble, mine, default)

export interface Skin {
  id: string;
  name: string;
  blurb: string;
  /** page behind the player + its text */
  page: string;
  pageInk: string;
  /** body of the player */
  body: string;
  bodyBorder: string;
  bodyShadow: string;
  bodyRadius: number;
  /** LCD */
  lcdFrame: string;
  lcdBg: string;
  lcdShadow: string;
  lcdRadius: number;
  head: string;
  ink: string;
  inkOn: string;
  line: string;
  hi: string;
  frame: string;
  input: string;
  sticky: string;
  glow?: string;
  mono?: boolean;
  /** round buttons */
  btnBg: string;
  btnBorder: string;
  btnInk: string;
  btnShadow: string;
  btnRadius: string;
  label: string;
  /** cute decoration on top of the body */
  deco?: 'cat' | 'bunny' | 'deer' | 'knob';
  decoA?: string;
  decoB?: string;
}

const brushed = 'repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,0) 1px 3px)';

export const SKINS: Skin[] = [
  {
    id: 'silver', name: '실버', blurb: '브러시드 메탈의 클래식 MP3',
    page: 'radial-gradient(circle at 50% 0%, #2e3340, #14161c 70%)', pageInk: '#e8eaf0',
    body: 'linear-gradient(160deg,#f5f5f7 0%,#c7cad1 52%,#e8e9ed 100%)', bodyBorder: '#8d9098',
    bodyShadow: '0 18px 40px rgba(0,0,0,.55), inset 0 1px 0 #fff, inset 0 -2px 6px rgba(0,0,0,.18)', bodyRadius: 34,
    lcdFrame: '3px solid #565a63', lcdBg: 'linear-gradient(180deg,#dcebf0,#bdd3dc)', lcdShadow: 'inset 0 2px 8px rgba(0,0,0,.35)', lcdRadius: 12,
    head: 'linear-gradient(180deg,#a9c3ce,#8fb0be)', ink: '#10303c', inkOn: '#e5f1f5',
    line: 'rgba(16,48,60,.14)', hi: 'rgba(16,48,60,.16)', frame: 'rgba(16,48,60,.4)', input: '#eef6f9', sticky: '#c3d8e0',
    btnBg: 'linear-gradient(180deg,#fdfdfe,#d5d7dc)', btnBorder: '#8e9199', btnInk: '#2b2e35', btnShadow: '0 2px 3px rgba(0,0,0,.25), inset 0 1px 0 #fff', btnRadius: '50%',
    label: '#5a5d66',
  },
  {
    id: 'black', name: '블랙 메탈', blurb: '검은 본체에 호박색 화면',
    page: 'radial-gradient(circle at 50% 0%, #25262c, #0a0a0c 70%)', pageInk: '#e8eaf0',
    body: `${brushed}, linear-gradient(160deg,#50535b 0%,#1d1e22 55%,#34363d 100%)`, bodyBorder: '#050506',
    bodyShadow: '0 18px 40px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.25), inset 0 -2px 6px rgba(0,0,0,.5)', bodyRadius: 30,
    lcdFrame: '3px solid #0b0b0d', lcdBg: 'linear-gradient(180deg,#f3c66e,#d9a23c)', lcdShadow: 'inset 0 2px 8px rgba(0,0,0,.5)', lcdRadius: 8,
    head: 'linear-gradient(180deg,#c98f21,#a8730f)', ink: '#3a2300', inkOn: '#ffe9b8',
    line: 'rgba(58,35,0,.2)', hi: 'rgba(58,35,0,.2)', frame: 'rgba(58,35,0,.5)', input: '#fbe3a8', sticky: '#e3b455', mono: true,
    btnBg: 'linear-gradient(180deg,#666972,#2a2c32)', btnBorder: '#08090a', btnInk: '#f0f1f5', btnShadow: '0 2px 4px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.25)', btnRadius: '50%',
    label: '#9a9da6',
  },
  {
    id: 'pink', name: '파스텔 핑크', blurb: '말랑한 분홍 본체와 민트 화면',
    page: 'radial-gradient(circle at 50% 0%, #5a3c4b, #231820 70%)', pageInk: '#fbe9f0',
    body: 'linear-gradient(160deg,#fff0f5 0%,#f6b9cd 55%,#ffe2ec 100%)', bodyBorder: '#d68aa6',
    bodyShadow: '0 18px 40px rgba(0,0,0,.45), inset 0 2px 0 #fff, inset 0 -3px 8px rgba(190,80,120,.25)', bodyRadius: 40,
    lcdFrame: '3px solid #c47892', lcdBg: 'linear-gradient(180deg,#e9f8f0,#bfe6d3)', lcdShadow: 'inset 0 2px 6px rgba(120,40,70,.3)', lcdRadius: 16,
    head: 'linear-gradient(180deg,#a8dcc5,#86c7ac)', ink: '#14473a', inkOn: '#effaf5',
    line: 'rgba(20,71,58,.14)', hi: 'rgba(20,71,58,.15)', frame: 'rgba(20,71,58,.38)', input: '#f3fcf8', sticky: '#cdeadc',
    btnBg: 'linear-gradient(180deg,#ffffff,#fbd3e0)', btnBorder: '#d68aa6', btnInk: '#8a2b50', btnShadow: '0 3px 4px rgba(150,50,90,.3), inset 0 1px 0 #fff', btnRadius: '50%',
    label: '#b0587a',
  },
  {
    id: 'wood', name: '우드 레트로', blurb: '나뭇결 본체, 크림색 화면, 황동 버튼',
    page: 'radial-gradient(circle at 50% 0%, #4a3020, #17100a 70%)', pageInk: '#f3e6d0',
    body: 'repeating-linear-gradient(95deg, rgba(50,24,6,.22) 0 2px, rgba(0,0,0,0) 2px 7px), repeating-linear-gradient(88deg, rgba(255,220,170,.07) 0 1px, rgba(0,0,0,0) 1px 11px), linear-gradient(160deg,#b27a45 0%,#6d4325 55%,#93602f 100%)', bodyBorder: '#3a210f',
    bodyShadow: '0 18px 40px rgba(0,0,0,.6), inset 0 2px 0 rgba(255,225,180,.35), inset 0 -3px 8px rgba(0,0,0,.4)', bodyRadius: 20,
    lcdFrame: '4px solid #2a1808', lcdBg: 'linear-gradient(180deg,#f6edd2,#e0d0a6)', lcdShadow: 'inset 0 2px 8px rgba(40,20,0,.45)', lcdRadius: 6,
    head: 'linear-gradient(180deg,#cdb67f,#b79e61)', ink: '#3b2a14', inkOn: '#fbf3dc',
    line: 'rgba(59,42,20,.18)', hi: 'rgba(59,42,20,.16)', frame: 'rgba(59,42,20,.45)', input: '#fbf5e2', sticky: '#dccb9d',
    btnBg: 'linear-gradient(180deg,#f6e6b6,#bf9444)', btnBorder: '#6b4a14', btnInk: '#3b2a14', btnShadow: '0 3px 4px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.6)', btnRadius: '30%',
    label: '#e6cf9f',
  },
  {
    id: 'neon', name: '네온 사이버', blurb: '어두운 본체와 빛나는 푸른 화면',
    page: 'radial-gradient(circle at 50% 0%, #1b1450, #06051a 70%)', pageInk: '#d9d6ff',
    body: 'linear-gradient(160deg,#241e5c 0%,#0c0b26 55%,#1a1545 100%)', bodyBorder: '#6a5bff',
    bodyShadow: '0 0 28px rgba(106,91,255,.55), 0 18px 40px rgba(0,0,0,.7), inset 0 1px 0 rgba(160,150,255,.4)', bodyRadius: 28,
    lcdFrame: '2px solid #38e1ff', lcdBg: 'linear-gradient(180deg,#06142b,#0a2140)', lcdShadow: 'inset 0 0 18px rgba(56,225,255,.35), 0 0 12px rgba(56,225,255,.4)', lcdRadius: 6,
    head: 'linear-gradient(180deg,#0f3563,#0b2a50)', ink: '#6ff3ff', inkOn: '#06142b',
    line: 'rgba(111,243,255,.2)', hi: 'rgba(111,243,255,.2)', frame: 'rgba(111,243,255,.55)', input: '#0b2447', sticky: '#0a2244', mono: true, glow: '0 0 6px rgba(111,243,255,.7)',
    btnBg: 'linear-gradient(180deg,#2c2766,#14123a)', btnBorder: '#6a5bff', btnInk: '#6ff3ff', btnShadow: '0 0 10px rgba(106,91,255,.6), inset 0 1px 0 rgba(160,150,255,.4)', btnRadius: '50%',
    label: '#8e86ff',
  },
  {
    id: 'sky', name: '스카이 블루', blurb: '맑은 하늘색 본체, 하얀 화면',
    page: 'radial-gradient(circle at 50% 0%, #2c4560, #101a26 70%)', pageInk: '#e6f1fb',
    body: 'linear-gradient(160deg,#eaf5ff 0%,#8fc3f2 55%,#d7ecff 100%)', bodyBorder: '#5b93c9',
    bodyShadow: '0 18px 40px rgba(0,0,0,.5), inset 0 2px 0 #fff, inset 0 -3px 8px rgba(40,100,170,.3)', bodyRadius: 36,
    lcdFrame: '3px solid #4a7fb0', lcdBg: 'linear-gradient(180deg,#f6fbff,#d4e7f8)', lcdShadow: 'inset 0 2px 6px rgba(20,60,110,.3)', lcdRadius: 14,
    head: 'linear-gradient(180deg,#a5c8e8,#86b3dc)', ink: '#12315a', inkOn: '#eef6ff',
    line: 'rgba(18,49,90,.14)', hi: 'rgba(18,49,90,.15)', frame: 'rgba(18,49,90,.38)', input: '#f7fbff', sticky: '#c4dcf2',
    btnBg: 'linear-gradient(180deg,#ffffff,#cfe3f6)', btnBorder: '#5b93c9', btnInk: '#1c4a80', btnShadow: '0 3px 4px rgba(20,70,130,.3), inset 0 1px 0 #fff', btnRadius: '50%',
    label: '#3f6c9c',
  },
  {
    id: 'dap', name: '건메탈 플레이어', blurb: '짙은 회색 금속 본체, 검은 화면에 주황 포인트',
    page: 'radial-gradient(circle at 50% 0%, #2b2d31, #0c0d0f 70%)', pageInk: '#e8eaf0',
    body: `${brushed}, linear-gradient(155deg,#5a5e66 0%,#2b2d32 50%,#44474e 100%)`, bodyBorder: '#111214',
    bodyShadow: '0 18px 40px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 6px rgba(0,0,0,.5)', bodyRadius: 22,
    lcdFrame: '4px solid #08090a', lcdBg: 'linear-gradient(180deg,#14161a,#0a0b0d)', lcdShadow: 'inset 0 2px 10px rgba(0,0,0,.8)', lcdRadius: 6,
    head: 'linear-gradient(180deg,#2a2c31,#1c1d21)', ink: '#f1f2f5', inkOn: '#1a0e00',
    line: 'rgba(255,255,255,.12)', hi: 'rgba(255,140,40,.35)', frame: 'rgba(255,150,50,.6)', input: '#1d1f24', sticky: '#1a1c20', mono: false,
    btnBg: 'linear-gradient(180deg,#8b8f98,#3d4046)', btnBorder: '#0c0d0f', btnInk: '#f4f5f8', btnShadow: '0 3px 5px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.45)', btnRadius: '50%',
    label: '#b4b7bf',
  },
  {
    id: 'slim', name: '슬림 블랙', blurb: '유광 검은 본체와 선명한 컬러 화면',
    page: 'radial-gradient(circle at 50% 0%, #20232b, #08090c 70%)', pageInk: '#eceef4',
    body: 'linear-gradient(135deg,rgba(255,255,255,.16) 0 18%,rgba(255,255,255,0) 18% 100%), linear-gradient(170deg,#262830 0%,#0d0e11 60%,#1a1c21 100%)', bodyBorder: '#000',
    bodyShadow: '0 18px 40px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.3)', bodyRadius: 14,
    lcdFrame: '3px solid #000', lcdBg: 'linear-gradient(180deg,#2b2455,#161a3d 55%,#0d2a52)', lcdShadow: 'inset 0 2px 8px rgba(0,0,0,.7)', lcdRadius: 6,
    head: 'linear-gradient(180deg,#3a2f78,#262259)', ink: '#f6e27a', inkOn: '#20183f',
    line: 'rgba(255,255,255,.14)', hi: 'rgba(246,226,122,.22)', frame: 'rgba(246,226,122,.55)', input: '#1c2050', sticky: '#201d4d',
    btnBg: 'linear-gradient(180deg,#2c2e36,#0b0c0f)', btnBorder: '#000', btnInk: '#f1f2f6', btnShadow: '0 2px 4px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.2)', btnRadius: '50%',
    label: '#a3a6b0',
  },
  {
    id: 'capsule', name: '네이비 캡슐', blurb: '둥근 캡슐형 남색 본체, 빨간 진행 막대',
    page: 'radial-gradient(circle at 50% 0%, #1c2650, #070a1a 70%)', pageInk: '#dfe5ff',
    body: 'linear-gradient(160deg,#34428f 0%,#1b2559 55%,#2a357a 100%)', bodyBorder: '#0f1638',
    bodyShadow: '0 18px 40px rgba(0,0,0,.65), inset 0 2px 0 rgba(255,255,255,.28), inset 0 -4px 10px rgba(0,0,10,.5)', bodyRadius: 56,
    lcdFrame: '5px solid #0a0e26', lcdBg: 'linear-gradient(180deg,#0b0b0e,#000)', lcdShadow: 'inset 0 2px 10px rgba(0,0,0,.9)', lcdRadius: 30,
    head: 'linear-gradient(180deg,#1a1d33,#0f1122)', ink: '#ffffff', inkOn: '#ffffff',
    line: 'rgba(255,255,255,.14)', hi: 'rgba(235,50,50,.4)', frame: 'rgba(235,70,70,.7)', input: '#14161f', sticky: '#101219',
    btnBg: 'linear-gradient(180deg,#3d4b9e,#222c68)', btnBorder: '#0f1638', btnInk: '#f2f4ff', btnShadow: '0 3px 5px rgba(0,0,20,.6), inset 0 1px 0 rgba(255,255,255,.3)', btnRadius: '50%',
    label: '#9aa6e6',
  },
  {
    id: 'cobalt', name: '코발트 팝', blurb: '밝은 파란 본체와 핑크 네온 포인트',
    page: 'radial-gradient(circle at 50% 0%, #1c3f8a, #07112b 70%)', pageInk: '#e6efff',
    body: 'linear-gradient(160deg,#4d9bff 0%,#1f66d6 55%,#3b86f0 100%)', bodyBorder: '#123f94',
    bodyShadow: '0 18px 40px rgba(0,10,50,.6), inset 0 2px 0 rgba(255,255,255,.45), inset 0 -4px 10px rgba(0,30,110,.4)', bodyRadius: 26,
    lcdFrame: '5px solid #0a1630', lcdBg: 'linear-gradient(180deg,#1b1747,#2a1f66 55%,#a64a93)', lcdShadow: 'inset 0 2px 10px rgba(0,0,0,.7)', lcdRadius: 10,
    head: 'linear-gradient(180deg,#2a2370,#1a1648)', ink: '#ffd6f2', inkOn: '#2a0d3d',
    line: 'rgba(255,214,242,.18)', hi: 'rgba(255,120,210,.3)', frame: 'rgba(255,140,220,.65)', input: '#241d5c', sticky: '#201a55', glow: '0 0 6px rgba(255,120,210,.6)',
    btnBg: 'linear-gradient(180deg,#5aa6ff,#1d5fc9)', btnBorder: '#123f94', btnInk: '#ffffff', btnShadow: '0 3px 5px rgba(0,20,90,.5), inset 0 1px 0 rgba(255,255,255,.5)', btnRadius: '50%',
    label: '#e6f0ff',
  },
  {
    id: 'stage', name: '클래식 블랙', blurb: '무광 검은 본체, 무대 사진이 어울리는 어두운 화면',
    page: 'radial-gradient(circle at 50% 0%, #1b1c20, #050506 70%)', pageInk: '#e8e9ee',
    body: 'linear-gradient(160deg,#2d2f35 0%,#101113 55%,#222429 100%)', bodyBorder: '#000',
    bodyShadow: '0 18px 40px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -2px 6px rgba(0,0,0,.6)', bodyRadius: 18,
    lcdFrame: '4px solid #000', lcdBg: 'linear-gradient(180deg,#242a3a,#12151f 60%,#2a1e2c)', lcdShadow: 'inset 0 2px 10px rgba(0,0,0,.8)', lcdRadius: 8,
    head: 'linear-gradient(180deg,#171a24,#0e1018)', ink: '#e9ebf3', inkOn: '#0e1018',
    line: 'rgba(255,255,255,.12)', hi: 'rgba(255,255,255,.2)', frame: 'rgba(255,255,255,.5)', input: '#171a24', sticky: '#141620',
    btnBg: 'linear-gradient(180deg,#34363c,#0e0f12)', btnBorder: '#000', btnInk: '#eef0f6', btnShadow: '0 3px 5px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.2)', btnRadius: '50%',
    label: '#8e919b',
  },
  {
    id: 'touch', name: '터치 플레이어', blurb: '유리 화면 터치형, 위쪽 황금 볼륨 다이얼',
    page: 'radial-gradient(circle at 50% 0%, #1f2024, #050506 70%)', pageInk: '#eceef3',
    body: 'linear-gradient(135deg,rgba(255,255,255,.1) 0 22%,rgba(255,255,255,0) 22% 100%), linear-gradient(170deg,#2a2b30 0%,#0c0c0e 60%,#1b1c20 100%)', bodyBorder: '#000',
    bodyShadow: '0 18px 40px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.25)', bodyRadius: 14,
    lcdFrame: '3px solid #000', lcdBg: 'linear-gradient(135deg,rgba(255,255,255,.07) 0 30%,rgba(255,255,255,0) 30% 100%), linear-gradient(180deg,#15161b,#050506)', lcdShadow: 'inset 0 2px 10px rgba(0,0,0,.8)', lcdRadius: 10,
    head: 'linear-gradient(180deg,#14151a,#0a0a0d)', ink: '#f4f5f8', inkOn: '#ffffff',
    line: 'rgba(255,255,255,.16)', hi: 'rgba(235,45,60,.45)', frame: 'rgba(235,60,70,.75)', input: '#1a1b20', sticky: '#121318',
    btnBg: 'linear-gradient(180deg,#30323a,#0c0d10)', btnBorder: '#000', btnInk: '#f4f5f8', btnShadow: '0 2px 4px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.18)', btnRadius: '50%',
    label: '#8e919b', deco: 'knob', decoA: '#e8c27a', decoB: '#8a6a2a',
  },
  {
    id: 'cat', name: '고양이', blurb: '하얀 본체에 하늘색 고양이 귀',
    page: 'radial-gradient(circle at 50% 0%, #cfe9f8, #7fb6dc 75%)', pageInk: '#16405e',
    body: 'linear-gradient(160deg,#ffffff 0%,#e8f1f7 60%,#ffffff 100%)', bodyBorder: '#b9d3e3',
    bodyShadow: '0 16px 30px rgba(20,70,110,.35), inset 0 2px 0 #fff, inset 0 -4px 10px rgba(80,140,180,.2)', bodyRadius: 48,
    lcdFrame: '6px solid #101216', lcdBg: 'linear-gradient(180deg,#bfe3f7,#9fd0ee)', lcdShadow: 'inset 0 2px 8px rgba(0,0,0,.4)', lcdRadius: 30,
    head: 'linear-gradient(180deg,#8ec8ec,#6fb4e0)', ink: '#12384f', inkOn: '#f2fbff',
    line: 'rgba(18,56,79,.16)', hi: 'rgba(18,56,79,.18)', frame: 'rgba(18,56,79,.4)', input: '#f1faff', sticky: '#b5dcf3',
    btnBg: 'linear-gradient(180deg,#7fd0f5,#47aee3)', btnBorder: '#2f8fc4', btnInk: '#ffffff', btnShadow: '0 3px 4px rgba(30,100,150,.4), inset 0 1px 0 rgba(255,255,255,.6)', btnRadius: '50%',
    label: '#3d7ea6', deco: 'cat', decoA: '#ffffff', decoB: '#7fd0f5',
  },
  {
    id: 'bunny', name: '토끼', blurb: '하얀 본체에 분홍 토끼 귀',
    page: 'radial-gradient(circle at 50% 0%, #ffe4ee, #e9a9c2 75%)', pageInk: '#6a2442',
    body: 'linear-gradient(160deg,#ffffff 0%,#f6ecf0 60%,#ffffff 100%)', bodyBorder: '#e8c4d2',
    bodyShadow: '0 16px 30px rgba(150,60,100,.35), inset 0 2px 0 #fff, inset 0 -4px 10px rgba(220,130,170,.2)', bodyRadius: 48,
    lcdFrame: '6px solid #2c2c2e', lcdBg: 'linear-gradient(180deg,#4a4a4d,#363638)', lcdShadow: 'inset 0 2px 8px rgba(0,0,0,.5)', lcdRadius: 30,
    head: 'linear-gradient(180deg,#2b2b2d,#202022)', ink: '#ffffff', inkOn: '#2b2b2d',
    line: 'rgba(255,255,255,.18)', hi: 'rgba(255,150,190,.35)', frame: 'rgba(255,170,205,.7)', input: '#3a3a3d', sticky: '#2f2f31',
    btnBg: 'linear-gradient(180deg,#ffb4d2,#f08ab4)', btnBorder: '#d86d9a', btnInk: '#ffffff', btnShadow: '0 3px 4px rgba(170,60,110,.4), inset 0 1px 0 rgba(255,255,255,.6)', btnRadius: '50%',
    label: '#b8648a', deco: 'bunny', decoA: '#ffffff', decoB: '#f9d3e1',
  },
  {
    id: 'deer', name: '사슴', blurb: '먼지분홍 본체에 뿔과 귀',
    page: 'radial-gradient(circle at 50% 0%, #6d3a52, #25141d 75%)', pageInk: '#fbe3ee',
    body: 'linear-gradient(160deg,#e7a6bf 0%,#c97a9a 60%,#dc95b0 100%)', bodyBorder: '#a85a7b',
    bodyShadow: '0 16px 30px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.4), inset 0 -4px 10px rgba(120,40,80,.3)', bodyRadius: 48,
    lcdFrame: '6px solid #d58aa8', lcdBg: 'linear-gradient(180deg,#34323a,#1f1e24)', lcdShadow: 'inset 0 2px 8px rgba(0,0,0,.6)', lcdRadius: 30,
    head: 'linear-gradient(180deg,#2a2830,#1a1a1f)', ink: '#ffffff', inkOn: '#2a2830',
    line: 'rgba(255,255,255,.16)', hi: 'rgba(240,150,185,.35)', frame: 'rgba(240,160,195,.7)', input: '#2e2c34', sticky: '#25232b',
    btnBg: 'linear-gradient(180deg,#f2c4d6,#d99ab6)', btnBorder: '#b0668a', btnInk: '#7a2e52', btnShadow: '0 3px 4px rgba(90,20,60,.45), inset 0 1px 0 rgba(255,255,255,.5)', btnRadius: '50%',
    label: '#f6d3e2', deco: 'deer', decoA: '#d58aa8', decoB: '#efc0d3',
  },
];

export const skinById = (id: string | null | undefined): Skin => SKINS.find(s => s.id === id) ?? SKINS[0];

const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const seen = new Map<string, Promise<string | null>>();

/** First existing picture among `<dir>/<name>.webp|jpg|png` (or null). Results are remembered. */
export function probeImage(dir: string, name: string): Promise<string | null> {
  const key = `${dir}/${name}`;
  let p = seen.get(key);
  if (!p) {
    p = (async () => {
      for (const ext of ['webp', 'jpg', 'png']) {
        const url = `${BASE}harmony/${dir}/${name}.${ext}`;
        const ok = await new Promise<boolean>(res => {
          const i = new Image();
          i.onload = () => res(true);
          i.onerror = () => res(false);
          i.src = url;
        });
        if (ok) return url;
      }
      return null;
    })();
    seen.set(key, p);
  }
  return p;
}
