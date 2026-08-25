export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
export type ImageQuality = "standard" | "hd";

export interface User {
  id: number;
  email: string;
  display_name: string;
  date_joined: string;
}

export interface GeneratedImage {
  id: number;
  prompt: string;
  image_url: string;
  size: ImageSize;
  quality: ImageQuality;
  provider: string;
  model: string;
  width: number;
  height: number;
  byte_size: number;
  download_filename: string;
  created_at: string;
}

export interface SizeOption {
  value: ImageSize;
  label: string;
  aspect: string;
}

export interface QualityOption {
  value: ImageQuality;
  label: string;
}

export interface GenerationOptions {
  sizes: SizeOption[];
  qualities: QualityOption[];
  provider: string | null;
  model: string | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AuthResult {
  access: string;
  user: User;
}

export interface GenerationInput {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
}
