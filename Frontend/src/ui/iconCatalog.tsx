import {
    Baby,
    Banknote,
    Bike,
    BookOpen,
    Briefcase,
    Building2,
    Bus,
    Cake,
    Car,
    ChefHat,
    Church,
    CircleDashed,
    Clapperboard,
    Coffee,
    CreditCard,
    Dog,
    Droplets,
    Dumbbell,
    Fuel,
    Gamepad2,
    Gift,
    GraduationCap,
    Hammer,
    HandCoins,
    HeartPulse,
    House,
    Landmark,
    MapPinned,
    Music,
    PartyPopper,
    PawPrint,
    PiggyBank,
    Pill,
    Plane,
    ReceiptText,
    Repeat2,
    Scissors,
    Shirt,
    ShoppingBag,
    ShoppingCart,
    Smartphone,
    Sofa,
    Sparkles,
    Stethoscope,
    Tv,
    Utensils,
    Wallet,
    Wifi,
    Wrench,
    Zap,
    type LucideIcon,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════
   Catálogo de ícones — lucide-react.

   A CHAVE É O NOME DO COMPONENTE. O banco guarda `"ShoppingCart"`, e
   quem transforma isso em desenho é este arquivo. Nenhum SVG trafega
   pela API, nenhuma migração é necessária quando o lucide muda o traço
   de um ícone, e trocar o conjunto oferecido é editar a lista abaixo.

   POR QUE UMA LISTA À MÃO, e não `import * as icons from "lucide-react"`
   com acesso dinâmico: o pacote exporta mais de seis mil componentes.
   Importá-los todos para indexar por string derrota o tree-shaking e
   traz o catálogo inteiro para dentro do bundle. Com nomes explícitos, o
   Rollup deixa entrar só o que está aqui — hoje 50 desenhos.

   O preço disso é que um nome fora desta lista não desenha. É preço
   pago de propósito: quem escolhe o ícone é o seletor da tela de
   Personalização, que oferece exatamente estes. Chave desconhecida cai
   no genérico em vez de virar um buraco na tela.
   ════════════════════════════════════════════════════════════ */

/** A ordem aqui é a ordem do seletor na tela. */
export const ICON_CATALOG: { key: string; label: string; Icon: LucideIcon }[] = [
    { key: "Utensils", label: "Alimentação", Icon: Utensils },
    { key: "ShoppingCart", label: "Mercado", Icon: ShoppingCart },
    { key: "ChefHat", label: "Restaurante", Icon: ChefHat },
    { key: "Coffee", label: "Café e lanche", Icon: Coffee },
    { key: "Cake", label: "Padaria e doces", Icon: Cake },

    { key: "Bus", label: "Transporte", Icon: Bus },
    { key: "Car", label: "Carro", Icon: Car },
    { key: "Bike", label: "Bicicleta", Icon: Bike },
    { key: "Fuel", label: "Combustível", Icon: Fuel },

    { key: "House", label: "Moradia", Icon: House },
    { key: "Sofa", label: "Casa e móveis", Icon: Sofa },
    { key: "ReceiptText", label: "Contas de casa", Icon: ReceiptText },
    { key: "Zap", label: "Energia", Icon: Zap },
    { key: "Droplets", label: "Água", Icon: Droplets },
    { key: "Wifi", label: "Internet", Icon: Wifi },
    { key: "Smartphone", label: "Telefone", Icon: Smartphone },
    { key: "Hammer", label: "Reforma", Icon: Hammer },
    { key: "Wrench", label: "Manutenção", Icon: Wrench },

    { key: "HeartPulse", label: "Saúde", Icon: HeartPulse },
    { key: "Stethoscope", label: "Consultas", Icon: Stethoscope },
    { key: "Pill", label: "Farmácia", Icon: Pill },
    { key: "Dumbbell", label: "Academia", Icon: Dumbbell },
    { key: "Scissors", label: "Cuidados pessoais", Icon: Scissors },

    { key: "GraduationCap", label: "Educação", Icon: GraduationCap },
    { key: "BookOpen", label: "Livros e cursos", Icon: BookOpen },

    { key: "Clapperboard", label: "Lazer", Icon: Clapperboard },
    { key: "PartyPopper", label: "Festas", Icon: PartyPopper },
    { key: "Gamepad2", label: "Jogos", Icon: Gamepad2 },
    { key: "Music", label: "Música", Icon: Music },
    { key: "Tv", label: "Assinaturas", Icon: Tv },

    { key: "Plane", label: "Viagem", Icon: Plane },
    { key: "MapPinned", label: "Passeios", Icon: MapPinned },

    { key: "ShoppingBag", label: "Compras", Icon: ShoppingBag },
    { key: "Shirt", label: "Vestuário", Icon: Shirt },
    { key: "Gift", label: "Presentes", Icon: Gift },
    { key: "Sparkles", label: "Beleza", Icon: Sparkles },

    { key: "PawPrint", label: "Pets", Icon: PawPrint },
    { key: "Dog", label: "Veterinário", Icon: Dog },
    { key: "Baby", label: "Filhos", Icon: Baby },
    { key: "Church", label: "Doações e dízimo", Icon: Church },

    { key: "Briefcase", label: "Trabalho", Icon: Briefcase },
    { key: "Building2", label: "Empresa", Icon: Building2 },
    { key: "Landmark", label: "Impostos", Icon: Landmark },
    { key: "PiggyBank", label: "Investimentos", Icon: PiggyBank },
    { key: "HandCoins", label: "Empréstimos", Icon: HandCoins },
    { key: "CreditCard", label: "Cartão", Icon: CreditCard },
    { key: "Banknote", label: "Dinheiro", Icon: Banknote },
    { key: "Wallet", label: "Carteira", Icon: Wallet },

    { key: "Repeat2", label: "Recorrentes", Icon: Repeat2 },
    { key: "CircleDashed", label: "Outros", Icon: CircleDashed },
];

const BY_KEY = new Map(ICON_CATALOG.map((entry) => [entry.key, entry]));

/** Genérico para chave que este catálogo não conhece: a categoria
 *  continua na tela, com um desenho neutro, em vez de virar um buraco.
 *  É o mesmo "Outros" que o seletor oferece. */
const Fallback = CircleDashed;

const iconFor = (iconKey: string | null | undefined): LucideIcon =>
    (iconKey ? BY_KEY.get(iconKey)?.Icon : undefined) ?? Fallback;

/** Desenha o ícone de uma categoria pela chave — o consumo mais comum,
 *  que evita `const Icon = iconFor(...)` espalhado pelas telas.
 *
 *  `width`/`height` viram `undefined` — e o React omite prop indefinida —
 *  para o `<svg>` ficar só com o `viewBox` e ser dimensionado pelo CSS do
 *  contêiner, como todos os outros ícones do sistema. Ver o `adapt` de
 *  `src/ui/icons.tsx`. */
export function CategoryIcon({
    iconKey,
    className,
}: {
    iconKey: string | null | undefined;
    className?: string;
}) {
    const Icon = iconFor(iconKey);
    return <Icon className={className} width={undefined} height={undefined} aria-hidden />;
}
