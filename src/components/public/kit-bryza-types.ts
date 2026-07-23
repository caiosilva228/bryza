export interface AmbassadorPublicInfo {
  display_name: string;
  referral_code: string;
  photo_path?: string | null;
  custom_message?: string | null;
  city?: string | null;
  instagram?: string | null;
}

export interface ProductOffer {
  id: string;
  nome_produto: string;
  preco_venda: number;
}

export interface KitBryzaSalesPageProps {
  ambassador: AmbassadorPublicInfo;
  products: ProductOffer[];
}

