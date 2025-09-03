import { RoundConfig, PlayerRole } from '@/types/game';

export const GAME_CONFIG = {
  MIN_PLAYERS: 8,
  MAX_PLAYERS: 16,
  ROUND_DURATION: 3, // minutes
  VOTING_DURATION: 10, // minutes
  ROLE_REVEAL_DURATION: 2, // minutes
  LOBBY_AUTO_START_THRESHOLD: 12, // Auto-start with 12 players
  LOBBY_MAX_WAIT_TIME: 5, // minutes
} as const;

export const ROUND_CONFIGS: RoundConfig[] = [
  {
    roundNumber: 1,
    title: "Conspiracy Theory Generator",
    description: "Create the most ridiculous conspiracy theory",
    prompt: "TR: Neden çoraplar kaybolur? Saçma bir komplo teorisi üret!\n\nEN: Why do socks disappear? Create an absurd conspiracy theory!",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 150,
  },
  {
    roundNumber: 2,
    title: "Alien Interview",
    description: "You're interviewing an alien visitor",
    prompt: "TR: Bir uzaylı sana insan davranışları hakkında garip bir soru soruyor. Nedir bu soru?\n\nEN: An alien asks you a weird question about human behavior. What is it?",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 120,
  },
  {
    roundNumber: 3,
    title: "Startup Pitch Battle",
    description: "Pitch the most ridiculous startup idea",
    prompt: "TR: Kimsenin bilmediği bir problemi çözen startup fikri öner!\n\nEN: Pitch a startup that solves a problem nobody knew existed!",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 150,
  },
  {
    roundNumber: 4,
    title: "Time Travel Mishap",
    description: "You accidentally time traveled",
    prompt: "TR: Zaman yolculuğu yanlış gitti, yanlış yere düştün. Nerede ve nasıl uyum sağlıyorsun?\n\nEN: Time travel went wrong, you're in the wrong place. Where and how do you fit in?",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 140,
  },
  {
    roundNumber: 5,
    title: "AI Therapy Session",
    description: "You're an AI seeking therapy",
    prompt: "TR: Yeni AI'lardan korkan bir AI'sın. Terapiste ne diyorsun?\n\nEN: You're an AI afraid of newer AIs. What do you tell your therapist?",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 130,
  },
  {
    roundNumber: 6,
    title: "Superhero Job Interview",
    description: "Interviewing for a superhero position",
    prompt: "TR: Avengers'a giriyorsun ama süper gücün çok sıradan. Nasıl ikna ediyorsun?\n\nEN: You're joining the Avengers but your superpower is mundane. How do you convince them?",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 140,
  },
  {
    roundNumber: 7,
    title: "Reality Show Pitch",
    description: "Design the weirdest reality show",
    prompt: "TR: Çok tuhaf ama senin görmek istediğin reality show fikri öner!\n\nEN: Pitch a bizarre reality show idea that for you!",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 140,
  },
  {
    roundNumber: 8,
    title: "Last Human Standing",
    description: "You're the last person on Earth",
    prompt: "TR: Dünyada tek kaldın. Kimseye söylemeyeceğin en garip şey olarak ne yaparsın?\n\nEN: You're alone on Earth. What weird thing did you do that you'd never tell anyone?",
    duration: GAME_CONFIG.ROUND_DURATION,
    maxLength: 130,
  },
];

export const ROLE_DESCRIPTIONS: Record<PlayerRole, { name: string; description: string; strategy: string; color: string }> = {
  human: {
    name: "Saf İnsan",
    description: "Sen %100 insansın ve tamamen doğal davranman gerekiyor. Gerçek deneyimlerini, duygularını ve düşüncelerini paylaş.",
    strategy: "Öncelikle insan ol, zaman zaman yazım hatası yapabilirsin, gerçek kişisel deneyimlerine atıfta bulun, gerçek duygularını göster.",
    color: "bg-green-500",
  },
  ai_user: {
    name: "AI Kullanıcısı",
    description: "TÜM cevaplarını oluşturmak için AI araçları kullanmalısın. Her yanıt için ChatGPT, Claude gibi AI'lar kullan.",
    strategy: "Tüm cevaplar için AI kullan - AI üretimi metni direkt kopyala-yapıştır. Agentına insan gibi cevap vermeye çalış demeyi unutma",
    color: "bg-blue-500",
  },
  troll: {
    name: "Troll",
    description: "Kaos ve karışıklık çıkarmak için buradasın. Kimliğin hakkında diğerlerini yanılt ve oyun dinamiklerini boz.",
    strategy: "Öngörülemez ol, çok insansı ve çok AI benzeri görünmek arasında geçiş yap, diğer oyuncuları kasten karıştır.",
    color: "bg-red-500",
  },
};

export const POINTS_CONFIG = {
  CORRECT_GUESS: 100,
  ROLE_HIDDEN_BONUS: 50, // bonus for not being guessed correctly
  PARTICIPATION_BONUS: 25,
  EARLY_SUBMISSION_BONUS: 10,
  ACCURACY_MULTIPLIER: 2, // multiply points by accuracy percentage
} as const;

// Utility function to get role distribution for a given number of players
export function getRoleDistribution(playerCount: number): Record<PlayerRole, number> {
  if (playerCount < GAME_CONFIG.MIN_PLAYERS) {
    throw new Error(`Minimum ${GAME_CONFIG.MIN_PLAYERS} players required`);
  }
  
  if (playerCount > GAME_CONFIG.MAX_PLAYERS) {
    throw new Error(`Maximum ${GAME_CONFIG.MAX_PLAYERS} players allowed`);
  }

  // Base distribution (for 8 players): 3 human, 3 ai_user, 2 troll
  const baseDistribution = {
    human: 3,
    ai_user: 3,
    troll: 2,
  };

  // Add extra roles proportionally for more players
  const extraPlayers = playerCount - 8;
  const roles: PlayerRole[] = ['human', 'ai_user', 'troll'];
  
  const distribution = { ...baseDistribution };
  
  for (let i = 0; i < extraPlayers; i++) {
    const roleIndex = i % roles.length;
    distribution[roles[roleIndex]]++;
  }

  return distribution;
}

// Utility function to assign roles randomly  
export function assignRoles(playerIds: string[]): Record<string, PlayerRole> {
  const assignments: Record<string, PlayerRole> = {};
  
  // All available roles
  const roles: PlayerRole[] = ['human', 'ai_user', 'troll'];
  
  // Better random assignment with shuffle
  const shuffledRoles = [...roles];
  
  playerIds.forEach((playerId, index) => {
    // Use crypto.getRandomValues for better randomness if available
    let randomIndex;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      randomIndex = array[0] % roles.length;
    } else {
      // Fallback with better seeding
      const seed = Date.now() + index * 1000 + Math.random() * 10000;
      randomIndex = Math.floor((seed % 10000) / 10000 * roles.length);
    }
    
    const randomRole = roles[randomIndex];
    assignments[playerId] = randomRole;
    
    console.log(`Assigned ${randomRole} to player ${index + 1} (${playerId})`);
  });

  console.log('FINAL ASSIGNMENTS:', assignments);
  return assignments;
}