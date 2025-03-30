// types.ts
export type UserSettings = {
    user_id: string;
    name: string | null;
    height: number | null;
    weight: number | null;
    sex: 'male' | 'female' | null;
    water_unit: 'ml' | 'oz';
    supplement_unit: 'g' | 'mg';
    water_goal: number;
    creatine_goal: number;
    users?: { email: string };
  };
  