import {
  Conversation,
  FraudEventLog,
  Profile,
  WalletTransaction,
} from '../domain/datingEngine';

export type NavTab = 'discover' | 'messages' | 'wallet' | 'security' | 'blueprint';

export interface PlatformState {
  user: {
    id: string;
    name: string;
    email: string;
    city: string;
    lowBalanceThreshold: number;
    location?: {
      lat: number;
      lng: number;
      label: string;
    };
  };
  wallet: {
    coinBalance: number;
    lifetimePurchased: number;
    lifetimeSpent: number;
  };
  profiles: Profile[];
  conversations: Conversation[];
  transactions: WalletTransaction[];
  fraudEvents: FraudEventLog[];
  lastSyncedAt: string;
}

export interface BlueprintFile {
  path: string;
  category: string;
  language: string;
  content: string;
}
