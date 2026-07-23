export const benefits = [
  { icon: 'sparkles', title: 'Limpeza eficiente', text: 'Ajuda a remover a sujeira do dia a dia com cuidado.' },
  { icon: 'leaf', title: 'Fórmulas concentradas', text: 'Mais rendimento e performance em cada lavagem.' },
  { icon: 'flower', title: 'Perfume prolongado', text: 'Fragrância agradável que acompanha o movimento dos tecidos.' },
  { icon: 'shield', title: 'Cuidado com os tecidos', text: 'Maciez para roupas, toalhas, lençóis e peças de uso diário.' },
] as const;

export const kitItems = [
  {
    kind: 'soap',
    label: '5 LITROS',
    title: 'Sabão Líquido Concentrado Bryza — 5L',
    description: 'Limpeza eficiente e rendimento para cuidar das roupas da sua família.',
    features: ['Alto rendimento', 'Limpeza eficiente', 'Perfume suave e agradável'],
    alt: 'Galão de 5 litros do Sabão Líquido Concentrado Bryza',
  },
  {
    kind: 'softener',
    label: '5 LITROS',
    title: 'Amaciante Concentrado Microencapsulado Bryza — 5L',
    description: 'Mais maciez e perfume para roupas, toalhas e roupas de cama.',
    features: ['Essência microencapsulada', 'Maciez prolongada', 'Perfume liberado com o movimento'],
    alt: 'Galão de 5 litros do Amaciante Concentrado Microencapsulado Bryza',
  },
  {
    kind: 'cloths',
    label: '2 UNIDADES DE BRINDE',
    title: '2 Panos Xadrez de Alta Absorção — 45 × 70 cm',
    description: 'Panos grandes, resistentes e desenvolvidos para facilitar as limpezas do dia a dia.',
    features: [
      'Alta capacidade de absorção',
      'Tamanho grande: 45 × 70 cm',
      'Tecido resistente para o uso diário',
      'Laváveis e reutilizáveis',
      'Ideais para diferentes ambientes da casa',
      'Estampa xadrez que disfarça melhor as marcas do uso diário',
    ],
    alt: 'Dois Panos Xadrez de Alta Absorção Bryza',
  },
] as const;

export const steps = [
  { title: 'Agende o pedido', text: 'Preencha seus dados e escolha o melhor período para receber.' },
  { title: 'Confirme sua região', text: 'A equipe Bryza verificará a disponibilidade da rota no seu endereço.' },
  { title: 'Receba em casa', text: 'O kit é entregue completo e você paga somente na entrega.' },
] as const;

export const faqs = [
  { question: 'Quantos litros vêm no kit?', answer: 'São 10 litros no total: 5 litros de Sabão Líquido Concentrado Bryza e 5 litros de Amaciante Concentrado Microencapsulado Bryza.' },
  { question: 'Os dois panos são realmente grátis?', answer: 'Sim. Comprando o kit completo, você recebe dois Panos Xadrez de Alta Absorção Bryza sem custo adicional, enquanto houver unidades destinadas à campanha.' },
  { question: 'Qual é o tamanho dos panos?', answer: 'Cada unidade mede 45 × 70 cm.' },
  { question: 'Preciso pagar antecipadamente?', answer: 'Não. O pagamento é realizado somente quando o pedido for entregue.' },
  { question: 'A entrega é grátis?', answer: 'Sim, para as regiões atendidas pelas rotas participantes da Bryza.' },
  { question: 'Posso escolher o horário da entrega?', answer: 'Você pode indicar o melhor período, e a equipe confirmará a disponibilidade da rota.' },
] as const;

export interface ProofItem {
  id: string;
  type: 'video' | 'image';
  category: 'sabao' | 'amaciante' | 'panos' | 'preparacao' | 'entrega' | 'bastidores';
  title: string;
  description: string;
  mediaUrl: string;
  posterUrl: string;
  alt: string;
  caption: string;
  location?: string;
  isPublished: boolean;
  isFeatured?: boolean;
}

export interface TestimonialItem {
  id: string;
  name: string;
  location: string;
  text: string;
  avatarUrl?: string | null;
  product: string;
  source: 'WhatsApp' | 'Instagram' | 'Atendimento Direto';
  authorized: boolean;
  isPublished: boolean;
}

export const realDemonstrations: ProofItem[] = [
  {
    id: 'demo-principal-01',
    type: 'video',
    category: 'sabao',
    title: 'Sabão Líquido e Amaciante Bryza na lavanderia',
    description: 'Demonstração real do Sabão Líquido Concentrado e Amaciante Microencapsulado em uso diário.',
    mediaUrl: 'https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/product-images/demo_bryza_video.mp4',
    posterUrl: '/hero-pv-link-embaixador.jpg',
    alt: 'Sabão Líquido Bryza sendo colocado na máquina de lavar durante teste real',
    caption: 'Demonstração dos produtos em uso na lavanderia.',
    isPublished: true,
    isFeatured: true,
  },
  {
    id: 'demo-panos-01',
    type: 'image',
    category: 'panos',
    title: 'Absorção dos Panos Xadrez Bryza',
    description: 'Teste real de capacidade de absorção dos panos de 45 × 70 cm.',
    mediaUrl: 'https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/product-images/prod_1784732736673_77ujv.svg',
    posterUrl: 'https://kkjrunhubqixftemndrm.supabase.co/storage/v1/object/public/product-images/prod_1784732736673_77ujv.svg',
    alt: 'Dois Panos Xadrez de Alta Absorção Bryza durante teste na superfície',
    caption: 'Demonstração do Pano Xadrez de Alta Absorção (45 × 70 cm).',
    isPublished: true,
  },
  {
    id: 'demo-preparacao-01',
    type: 'image',
    category: 'preparacao',
    title: 'Kits Bryza embalados para rota de entrega',
    description: 'Galões de 5L e panos organizados e preparados pela equipe Bryza.',
    mediaUrl: '/hero-products.webp',
    posterUrl: '/hero-products.webp',
    alt: 'Galões de 5 litros de Sabão e Amaciante Bryza com panos preparados para envio',
    caption: 'Kit Bryza completo embalado e pronto para entrega.',
    location: 'Central Bryza',
    isPublished: true,
  },
];

export const realTestimonials: TestimonialItem[] = [
  {
    id: 'testimonial-01',
    name: 'Maria',
    location: 'Cidade Ocidental',
    text: 'Recebi o kit certinho na minha porta. O amaciante deixa um cheiro maravilhoso na roupa de cama e os panos são enormes e realmente absorvem muito.',
    product: 'Kit Bryza 10L + 2 Panos',
    source: 'WhatsApp',
    authorized: true,
    isPublished: true,
  },
  {
    id: 'testimonial-02',
    name: 'Patricia',
    location: 'Luziânia',
    text: 'Achei super prático não ter que pagar adiantado. Paguei na entrega quando o entregador chegou. Os produtos renderam demais aqui em casa.',
    product: 'Kit Bryza 10L',
    source: 'WhatsApp',
    authorized: true,
    isPublished: true,
  },
  {
    id: 'testimonial-03',
    name: 'Luciana',
    location: 'Valparaíso de Goiás',
    text: 'Sabão de ótima qualidade e cheiroso. Os dois galões duram semanas na minha família. Recomendo de olhos fechados!',
    product: 'Kit Bryza 10L + 2 Panos',
    source: 'Atendimento Direto',
    authorized: true,
    isPublished: true,
  },
];

