from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics


ROOT = Path(r"C:\Users\lucas\Desktop\Bryza")
OUT = ROOT / "output" / "pdf" / "Relatorio_Priorizado_Melhorias_Programa_Embaixadores_Bryza.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#005675")
BLUE = colors.HexColor("#2A6F8F")
LIGHT = colors.HexColor("#EAF5FA")
PALE = colors.HexColor("#F6FAFC")
GOLD = colors.HexColor("#C88A20")
GOLD_LIGHT = colors.HexColor("#FFF5DD")
RED = colors.HexColor("#A63D40")
RED_LIGHT = colors.HexColor("#FCEDEF")
GREEN = colors.HexColor("#287A59")
GREEN_LIGHT = colors.HexColor("#EAF6F0")
INK = colors.HexColor("#24323B")
MUTED = colors.HexColor("#60717B")
LINE = colors.HexColor("#C8DCE5")
WHITE = colors.white


def find_font(candidates):
    for p in candidates:
        if Path(p).exists():
            return p
    return None


regular = find_font([
    r"C:\Windows\Fonts\calibri.ttf",
    r"C:\Windows\Fonts\arial.ttf",
])
bold = find_font([
    r"C:\Windows\Fonts\calibrib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
])
if regular and bold:
    pdfmetrics.registerFont(TTFont("Bryza", regular))
    pdfmetrics.registerFont(TTFont("Bryza-Bold", bold))
    BASE, BOLD = "Bryza", "Bryza-Bold"
else:
    BASE, BOLD = "Helvetica", "Helvetica-Bold"


PAGE_W, PAGE_H = A4
M_LEFT = 19 * mm
M_RIGHT = 19 * mm
M_TOP = 20 * mm
M_BOTTOM = 17 * mm


class NumberedDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        super().__init__(filename, **kwargs)
        frame = Frame(
            M_LEFT, M_BOTTOM, PAGE_W - M_LEFT - M_RIGHT, PAGE_H - M_TOP - M_BOTTOM,
            id="main", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=self.draw_page)])

    def draw_page(self, canvas, doc):
        canvas.saveState()
        if doc.page > 1:
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.5)
            canvas.line(M_LEFT, PAGE_H - 13 * mm, PAGE_W - M_RIGHT, PAGE_H - 13 * mm)
            canvas.setFont(BOLD, 7.5)
            canvas.setFillColor(MUTED)
            canvas.drawString(M_LEFT, PAGE_H - 10 * mm, "BRYZA | PROGRAMA DE EMBAIXADORES")
            canvas.setFont(BASE, 7.5)
            canvas.drawRightString(PAGE_W - M_RIGHT, PAGE_H - 10 * mm, "RELATORIO DE MELHORIAS")
        canvas.setStrokeColor(LINE)
        canvas.line(M_LEFT, 11 * mm, PAGE_W - M_RIGHT, 11 * mm)
        canvas.setFont(BASE, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(M_LEFT, 7.5 * mm, "Analise verificada em 22/07/2026")
        canvas.drawRightString(PAGE_W - M_RIGHT, 7.5 * mm, f"Pagina {doc.page}")
        canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    "CoverKicker", fontName=BOLD, fontSize=10, leading=12, textColor=GOLD,
    alignment=TA_CENTER, spaceAfter=10
))
styles.add(ParagraphStyle(
    "CoverTitle", fontName=BOLD, fontSize=27, leading=31, textColor=NAVY,
    alignment=TA_CENTER, spaceAfter=12
))
styles.add(ParagraphStyle(
    "CoverSub", fontName=BASE, fontSize=13, leading=18, textColor=BLUE,
    alignment=TA_CENTER, spaceAfter=24
))
styles.add(ParagraphStyle(
    "H1", fontName=BOLD, fontSize=16, leading=19, textColor=NAVY,
    spaceBefore=12, spaceAfter=8, keepWithNext=True
))
styles.add(ParagraphStyle(
    "H2", fontName=BOLD, fontSize=12.5, leading=15, textColor=BLUE,
    spaceBefore=10, spaceAfter=5, keepWithNext=True
))
styles.add(ParagraphStyle(
    "H3", fontName=BOLD, fontSize=10.5, leading=13, textColor=NAVY,
    spaceBefore=7, spaceAfter=3, keepWithNext=True
))
styles.add(ParagraphStyle(
    "Body", fontName=BASE, fontSize=9.3, leading=13.2, textColor=INK,
    spaceAfter=5
))
styles.add(ParagraphStyle(
    "Small", fontName=BASE, fontSize=8, leading=10.5, textColor=MUTED,
    spaceAfter=3
))
styles.add(ParagraphStyle(
    "BryzaBullet", fontName=BASE, fontSize=9.1, leading=12.6, textColor=INK,
    leftIndent=4 * mm, firstLineIndent=0, spaceAfter=2.5
))
styles.add(ParagraphStyle(
    "Callout", fontName=BASE, fontSize=9.1, leading=12.8, textColor=INK,
    leftIndent=2 * mm, rightIndent=2 * mm, spaceBefore=1, spaceAfter=1
))
styles.add(ParagraphStyle(
    "TableHead", fontName=BOLD, fontSize=8, leading=9.5, textColor=NAVY,
    alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    "TableBody", fontName=BASE, fontSize=7.8, leading=9.8, textColor=INK,
    alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    "Priority", fontName=BOLD, fontSize=9, leading=11, textColor=WHITE,
    alignment=TA_CENTER
))


def P(text, style="Body"):
    return Paragraph(text, styles[style])


def bullets(items, level=0):
    return ListFlowable(
        [ListItem(P(item, "BryzaBullet"), leftIndent=0) for item in items],
        bulletType="bullet", start="circle", leftIndent=(4 + level * 4) * mm,
        bulletFontName=BASE, bulletFontSize=6.5, bulletColor=BLUE,
        spaceAfter=4
    )


def numbered(items):
    return ListFlowable(
        [ListItem(P(item, "BryzaBullet"), leftIndent=0) for item in items],
        bulletType="1", leftIndent=6 * mm, bulletFontName=BOLD,
        bulletFontSize=8, bulletColor=NAVY, spaceAfter=5
    )


def callout(label, text, kind="info"):
    palette = {
        "info": (LIGHT, NAVY),
        "success": (GREEN_LIGHT, GREEN),
        "warning": (GOLD_LIGHT, GOLD),
        "danger": (RED_LIGHT, RED),
    }
    fill, accent = palette[kind]
    content = P(f"<font name='{BOLD}' color='{accent.hexval()}'>{label.upper()}</font>  {text}", "Callout")
    tbl = Table([[content]], colWidths=[PAGE_W - M_LEFT - M_RIGHT - 1 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fill),
        ("BOX", (0, 0), (-1, -1), 0.6, accent),
        ("LINEBEFORE", (0, 0), (0, 0), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether([tbl, Spacer(1, 3 * mm)])


def data_table(headers, rows, widths=None, font=7.7):
    usable = PAGE_W - M_LEFT - M_RIGHT
    if widths is None:
        widths = [usable / len(headers)] * len(headers)
    data = [[P(h, "TableHead") for h in headers]]
    for row in rows:
        data.append([Paragraph(str(v), ParagraphStyle(
            f"cell-{font}", parent=styles["TableBody"], fontSize=font, leading=font + 2
        )) for v in row])
    tbl = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
    ]))
    return tbl


def priority_badge(label, color):
    tbl = Table([[P(label, "Priority")]], colWidths=[25 * mm], rowHeights=[8 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0, color),
    ]))
    return tbl


story = []

# Cover
story += [Spacer(1, 34 * mm), P("RELATORIO EXECUTIVO E OPERACIONAL", "CoverKicker")]
story += [P("Melhorias prioritarias do Programa de Embaixadores Bryza", "CoverTitle")]
story += [P("Riscos atuais, modificacoes recomendadas, criterios de aceite e ordem de implementacao", "CoverSub")]
story += [Spacer(1, 10 * mm)]
story += [callout(
    "Conclusao principal",
    "A base do programa e consistente, mas o sistema nao deve ser escalado antes de corrigir o provisionamento de acesso, o momento de calculo das comissoes, a autorizacao do portal e a aplicacao da ativacao mensal.",
    "warning"
)]
story += [Spacer(1, 8 * mm)]
story += [data_table(
    ["Estado verificado em 22/07/2026", "Quantidade"],
    [
        ("Embaixadores cadastrados", "3"),
        ("Candidatos automaticos", "0"),
        ("Comissoes geradas", "0"),
        ("Pedidos com snapshot de comissao", "0"),
        ("Planos ativos sem valid_to", "2"),
    ],
    [115 * mm, 35 * mm], font=8.2
)]
story += [Spacer(1, 7 * mm), P("Este e o melhor momento para corrigir a arquitetura: ainda nao existe historico financeiro relevante a migrar.", "Small")]
story += [PageBreak()]

# Executive map
story += [P("1. Mapa executivo de prioridades", "H1")]
story += [data_table(
    ["Prioridade", "Modificacao", "Risco principal", "Resultado esperado"],
    [
        ("P0", "Provisionamento unico e idempotente", "Ativo sem login ou cadastro orfao", "Candidato vira usuario sem duplicidade"),
        ("P0", "Congelamento financeiro do pedido", "Comissao divergir da venda final", "Valor sempre reproduzivel"),
        ("P0", "Autorizacao real no portal", "Sessao antiga acessar dados via service_role", "Bloqueio efetivo e menor exposicao"),
        ("P0", "Ativacao mensal aplicada", "Regra comercial existir apenas na tela", "Qualificacao calculada e auditada"),
        ("P1", "Atribuicao e cookie coerentes", "Disputa sobre quem recebe a venda", "Uma politica unica e previsivel"),
        ("P1", "Pix, pagamentos e estornos", "Repasse incorreto ou sem conciliacao", "Lotes e ledger financeiro"),
        ("P1", "Versionamento de planos e base", "Planos ativos duplicados e calculo ambiguo", "Vigencia e calculo consistentes"),
        ("P1", "Testes financeiros em CI", "Regressoes silenciosas", "Mudancas verificadas automaticamente"),
        ("P2", "Consentimento, antifraude e observabilidade", "Abuso e risco de privacidade", "Operacao segura e mensuravel"),
        ("P2", "Rede dinamica e UX", "Produto nao acompanhar configuracao", "Portal escalavel e compreensivel"),
    ],
    [18 * mm, 48 * mm, 56 * mm, 48 * mm], font=6.9
)]
story += [Spacer(1, 5 * mm)]
story += [callout(
    "Recomendacao",
    "Tratar os itens P0 como bloqueadores de crescimento. Os itens P1 devem entrar imediatamente depois, antes de aumentar volume de vendas ou quantidade de embaixadores.",
    "danger"
)]

# P0 1
story += [PageBreak(), priority_badge("P0 - CRITICA", RED), P("2. Fluxo unico de ativacao e provisionamento", "H1")]
story += [P("Problema atual", "H2")]
story += [bullets([
    "A compra publica cria um registro pendente em ambassadors, com codigo Bryza e user_id vazio.",
    "Quando o administrador encontra o mesmo CPF, a API retorna sucesso e encerra o processo, sem criar conta Auth.",
    "Alterar o status para ativo nao cria usuario, senha ou profile.",
    "Assim, o banco pode representar como ativo alguem que nao consegue acessar o painel.",
])]
story += [P("Modificacoes necessarias", "H2")]
story += [numbered([
    "Separar status comercial de status de provisionamento: candidate, provisioning, provisioning_failed, provisioned e access_blocked.",
    "Criar a acao administrativa Provisionar acesso, capaz de continuar a partir de um candidato existente.",
    "Validar CPF, telefone, e-mail, plano, patrocinador e consentimento antes de criar a conta.",
    "Criar usuario Auth, profile e vinculo ambassadors.user_id antes de permitir status ativo.",
    "Tornar todo o processo idempotente por candidato/CPF e retomavel depois de falhas.",
    "Adicionar protecao no banco: status ativo exige user_id nao nulo e profile compativel.",
])]
story += [callout("Criterio de aceite", "Um comprador que recebeu codigo pode ser provisionado sem recadastro, duplicidade ou intervencao manual no banco.", "success")]
story += [P("Evidencias tecnicas", "H3")]
story += [P("Checkout automatico: migration 20260718044648, linhas 343-359. Retorno antecipado por CPF: src/app/api/embaixadores/route.ts, linhas 123-127. Alteracao de status: src/app/embaixadores/actions.ts, linhas 396-438.", "Small")]

# P0 2
story += [P("3. Provisionamento recuperavel, sem exclusao compensatoria", "H1")]
story += [P("A API insere o embaixador antes de criar a conta Auth. Se Auth ou profile falhar, tenta apagar o registro. Entretanto, outro trigger proibe exclusao fisica. O rollback pode falhar e deixar um cadastro orfao.", "Body")]
story += [bullets([
    "Nao usar DELETE como rollback de provisionamento.",
    "Registrar provisioning_failed com etapa e erro tecnico sanitizado.",
    "Permitir retomar o processo de forma segura.",
    "Criar uma fila administrativa de acessos com falha.",
    "Executar reconciliacao periodica: embaixador sem user_id, Auth sem profile e profile sem embaixador.",
])]
story += [callout("Criterio de aceite", "Nenhuma falha de Auth deve deixar um cadastro que pareca concluido ou exija limpeza manual.", "success")]

# P0 3 commission
story += [PageBreak(), priority_badge("P0 - FINANCEIRA", RED), P("4. Gerar comissao somente com pedido congelado", "H1")]
story += [callout("Maior risco financeiro", "As comissoes nascem no AFTER INSERT, enquanto pedidos em aguardando_preparacao ainda podem ser editados. O total pode mudar e a comissao permanecer com o valor antigo.", "danger")]
story += [P("Arquitetura recomendada", "H2")]
story += [numbered([
    "Adicionar commission_locked_at e um estado explicito de congelamento financeiro.",
    "Antes do congelamento, mostrar apenas uma previsao de ganho, sem criar registro financeiro definitivo.",
    "Gerar snapshots e comissoes quando o pedido sair da fase editavel, em uma unica transacao.",
    "Depois do congelamento, bloquear mudancas em itens, quantidade, preco, descontos, total, indicador e plano.",
    "Se a operacao precisar corrigir um pedido congelado, usar uma RPC auditada que gere versao ou estorno, nunca edicao silenciosa.",
])]
story += [P("Alternativa aceitavel", "H2")]
story += [P("Caso a Bryza precise gerar comissao na conversao do agendamento, toda edicao posterior deve passar por uma RPC que recalcula pedido, base, snapshots e comissoes atomicamente. A edicao deve ser proibida depois da confirmacao logistica/financeira.", "Body")]
story += [callout("Criterio de aceite", "Toda commission_amount pode ser reproduzida a partir dos itens, descontos, base e plano congelados naquele pedido.", "success")]
story += [P("Evidencias: trigger de geracao em migration 20260718044648, linhas 495-508; edicao de pedidos em src/services/pedidos.ts, linhas 153-180; sincronismo atual altera apenas status nas linhas 510-522.", "Small")]

# P0 4 monthly activation
story += [P("5. Implementar a ativacao mensal de R$ 79", "H1")]
story += [P("A configuracao vigente exige R$ 79 em compras pessoais e dez dias de tolerancia, mas o motor de comissoes verifica somente status cadastral ativo. A movimentacao mensal nao participa do calculo.", "Body")]
story += [P("Decisoes comerciais obrigatorias", "H2")]
story += [bullets([
    "A qualificacao vale na data da venda, entrega ou liberacao da comissao?",
    "O valor nao qualificado e perdido, retido ou liberado depois da regularizacao?",
    "Compras canceladas e estornadas deixam de contar?",
    "A compra precisa estar entregue e paga?",
    "A qualificacao afeta nivel direto, niveis indiretos ou ambos?",
])]
story += [P("Estrutura sugerida", "H2")]
story += [data_table(
    ["Campo", "Funcao"],
    [
        ("ambassador_id + reference_month", "Chave da competencia"),
        ("required_amount / qualified_amount", "Meta e valor apurado"),
        ("status", "em_apuracao, qualificado, em_tolerancia, nao_qualificado, override"),
        ("qualified_at / grace_expires_at", "Datas de qualificacao e tolerancia"),
        ("override_by / override_reason", "Excecao administrativa auditada"),
    ], [57 * mm, 113 * mm], font=7.8
)]
story += [callout("Regra recomendada", "Criar a comissao como retida_qualificacao. Liberar durante a tolerancia quando houver regularizacao; nao apagar registros financeiros.", "info")]

# P0 auth
story += [PageBreak(), priority_badge("P0 - SEGURANCA", RED), P("6. Remover service_role do fluxo comum do portal", "H1")]
story += [P("Algumas server actions validam apenas a existencia de uma sessao e depois consultam o banco com credencial administrativa, que ignora RLS. Minha Rede tambem retorna telefones completos dos descendentes.", "Body")]
story += [P("Modificacoes necessarias", "H2")]
story += [numbered([
    "Criar requireActiveAmbassador() e usa-lo em todas as server actions do portal.",
    "Validar profile.role, profile.ativo, must_change_password, ambassadors.status e correspondencia de user_id.",
    "Trocar consultas administrativas por RLS de propriedade ou RPCs que derivam o embaixador de auth.uid().",
    "Nunca aceitar ambassador_id do navegador para consultas pessoais.",
    "Mascarar telefone da rede ou exigir consentimento para disponibilizar contato.",
    "Revogar sessoes ao bloquear/inativar e validar session_id em operacoes financeiras sensiveis.",
])]
story += [callout("Risco", "Uma sessao antiga pode continuar autenticada. Se a server action usa service_role depois de validar apenas user, o bloqueio cadastral pode nao impedir a consulta.", "danger")]
story += [P("Referencia oficial: Supabase Service keys bypass RLS; Supabase User sessions e validacao de session_id. Evidencia local: src/app/embaixador/actions.ts, linhas 8-14 e 71-133.", "Small")]

# P1 attribution
story += [PageBreak(), priority_badge("P1 - ALTA", GOLD), P("7. Definir uma unica politica de atribuicao", "H1")]
story += [P("Hoje coexistem uma visita/cookie de 30 dias e uma primeira atribuicao bloqueada por tempo indeterminado. Um clique recente pode autorizar a compra, mas o valor continuar com o primeiro indicador historico.", "Body")]
story += [P("Politicas possiveis", "H2")]
story += [data_table(
    ["Modelo", "Vantagem", "Risco"],
    [
        ("First-touch 30 dias", "Valoriza aquisicao inicial", "Pode ignorar influencia recente"),
        ("Last-touch 30 dias", "Valoriza o ultimo contato", "Facilita disputa e roubo de atribuicao"),
        ("Permanente", "Rede simples e previsivel", "Janela de 30 dias perde sentido"),
        ("Congela apos 1a compra paga", "Equilibra aquisicao e rede", "Exige estado adicional"),
    ], [40 * mm, 64 * mm, 66 * mm], font=7.4
)]
story += [callout("Recomendacao", "Usar first-touch ate a primeira compra entregue e paga. Depois, congelar o patrocinador do novo embaixador e aplicar uma regra explicita para compras futuras do cliente.", "info")]
story += [bullets([
    "Definir comportamento quando o indicador original estiver inativo.",
    "Definir solicitacao de troca pelo cliente.",
    "Limitar reatribuicao a estados nao terminais e exigir motivo.",
    "Registrar historico de cada mudanca de atribuicao.",
])]

story += [P("8. Sincronizar cookie e janela configurada", "H1")]
story += [bullets([
    "Ler referral_attribution_days antes de criar o cookie.",
    "Usar o mesmo prazo em expires_at, maxAge e validacao do banco.",
    "Tornar REFERRAL_COOKIE_SECRET obrigatorio e remover fallback para service_role.",
    "Versionar o payload do cookie.",
    "Nao emitir cookie utilizavel quando a visita nao foi gravada.",
])]
story += [P("Evidencias: src/lib/referral/cookie.ts, linhas 29-41; src/app/r/[code]/route.ts, linhas 87-116; validacao dinamica do banco na migration 20260718044648, linhas 262-276.", "Small")]

# commission base and plans
story += [PageBreak(), priority_badge("P1 - FINANCEIRA", GOLD), P("9. Aplicar corretamente a base de comissao", "H1")]
story += [P("A interface aceita valor final, bruto ou liquido, mas o motor nao possui estrategias diferentes para essas opcoes. Enquanto isso nao estiver implementado, a configuracao transmite uma capacidade que o calculo nao entrega.", "Body")]
story += [data_table(
    ["Base", "Definicao recomendada"],
    [
        ("valor_bruto", "Soma de preco x quantidade antes de descontos"),
        ("valor_final", "Valor efetivamente cobrado do cliente"),
        ("valor_liquido", "Valor final menos componentes explicitamente excluidos da comissao"),
    ], [45 * mm, 125 * mm], font=8
)]
story += [bullets([
    "Criar uma unica funcao de calculo da base.",
    "Usa-la em checkout publico, pedido administrativo, conversao e testes.",
    "Congelar valor bruto, descontos elegiveis, itens nao comissionaveis e base final.",
    "Ate a implementacao, permitir somente valor_final na interface.",
])]

story += [P("10. Corrigir o versionamento dos planos", "H1")]
story += [P("Salvar qualquer configuracao cria um novo plano, migra embaixadores do plano anterior e mantem o plano antigo ativo. O banco atual ja possui dois planos ativos sem valid_to.", "Body")]
story += [numbered([
    "Separar configuracoes gerais de Publicar nova versao do plano.",
    "Criar versao somente quando niveis, percentuais ou base mudarem.",
    "Encerrar o plano anterior com valid_to e status inativo.",
    "Mostrar quantos embaixadores serao migrados antes da publicacao.",
    "Permitir vigencia futura e manter pedidos historicos no plano congelado.",
])]
story += [P("Evidencia: migration 20260718191617, linhas 335-379.", "Small")]

# Pix payments
story += [PageBreak(), priority_badge("P1 - PAGAMENTOS", GOLD), P("11. Criar fluxo seguro para alteracao de Pix", "H1")]
story += [P("Quando a aprovacao e exigida, o sistema apenas bloqueia a edicao; nao existe solicitacao. Quando e permitida, uma conta comprometida pode alterar a chave antes do repasse.", "Body")]
story += [bullets([
    "Criar solicitacoes de alteracao com chave anterior mascarada, nova chave protegida, status e aprovador.",
    "Exigir reautenticacao e, preferencialmente, MFA/OTP.",
    "Notificar o contato anterior do embaixador.",
    "Aplicar periodo de seguranca de 24 a 48 horas.",
    "Bloquear pagamentos durante alteracao pendente.",
    "Validar formato da chave e evitar texto completo em logs.",
])]

story += [P("12. Criar lotes, conciliacao e estornos", "H1")]
story += [P("Registrar pagamento hoje ja marca as comissoes como pagas. Nao existe confirmacao bancaria obrigatoria, falha de transferencia ou ledger de estorno.", "Body")]
story += [data_table(
    ["Estado", "Uso"],
    [
        ("rascunho", "Lote em preparacao"),
        ("aprovado", "Valores e Pix conferidos"),
        ("processando", "Transferencia iniciada"),
        ("pago", "Pix confirmado"),
        ("falhou", "Transferencia nao concluida"),
        ("cancelado / estornado", "Operacao anulada ou revertida"),
    ], [45 * mm, 125 * mm], font=8
)]
story += [bullets([
    "Marcar a comissao como paga somente depois da confirmacao do Pix.",
    "Exigir identificador bancario ou comprovante.",
    "Criar lancamento negativo para estornos; nao editar o valor original.",
    "Carregar saldo negativo para a proxima competencia quando necessario.",
    "Separar preparar lote de confirmar pagamento.",
])]

# testing
story += [PageBreak(), priority_badge("P1 - QUALIDADE", GOLD), P("13. Atualizar testes e criar CI financeiro", "H1")]
story += [P("As suites SQL existentes refletem partes antigas do esquema: limite de tres niveis, unicidade sem commission_type e colunas antigas. O lint tambem falha atualmente com dois erros em LandingPage.tsx.", "Body")]
story += [P("Cobertura obrigatoria", "H2")]
story += [bullets([
    "Candidato para embaixador ativo e retomada de provisionamento.",
    "Edicao de pedido antes e depois do congelamento.",
    "Ativacao mensal, tolerancia, cancelamento e override.",
    "Indicador original inativo e disputas de atribuicao.",
    "Pagamento minimo, falha de Pix, estorno e concorrencia.",
    "Planos de um a dez niveis e bonus da primeira compra.",
    "Usuario bloqueado tentando usar sessao antiga.",
])]
story += [P("Pipeline minimo", "H2")]
story += [numbered([
    "Lint e typecheck.",
    "Build Next.js.",
    "Banco limpo com todas as migrations.",
    "Testes SQL financeiros e de RLS.",
    "Testes end-to-end dos fluxos de venda, ativacao e pagamento.",
])]

# P2
story += [PageBreak(), priority_badge("P2 - CONSOLIDACAO", BLUE), P("14. Consentimento e protecao de dados", "H1")]
story += [P("Todo comprador pode receber um cadastro adicional em ambassadors. A adesao deve ser clara e comprovavel.", "Body")]
story += [bullets([
    "Checkbox de adesao ao programa, separado da compra.",
    "Termos versionados com data de aceite.",
    "Consentimento separado para comunicacoes.",
    "Opcao de comprar sem se tornar candidato.",
    "Politica de retencao para visitas, auditoria e dados de candidatos.",
    "Mascaramento de telefone e minimizacao de dados na rede.",
])]

story += [P("15. Antifraude no checkout publico", "H1")]
story += [bullets([
    "CAPTCHA ou Turnstile.",
    "Rate limit por IP hash, sessao, codigo, telefone, CPF e idempotency key.",
    "Deteccao de volume anormal por codigo de embaixador.",
    "Rejeicao explicita quando a visita nao for gravada.",
    "Retencao e limpeza de visitas antigas.",
])]

story += [P("16. Observabilidade operacional", "H1")]
story += [bullets([
    "Candidatos sem usuario e provisionamentos com falha.",
    "Embaixador ativo sem profile ou profile ativo com embaixador bloqueado.",
    "Pedido cujo total diverge do snapshot.",
    "Comissao parada por entrega, pagamento ou qualificacao.",
    "Alteracao recente de Pix e pagamentos abaixo do minimo.",
    "Indicador inativo com rede ativa e planos sem encerramento.",
    "Logs estruturados com correlation_id e alertas de falhas criticas.",
])]

story += [P("17. Rede dinamica e experiencia", "H1")]
story += [bullets([
    "Trocar as tres consultas fixas de Minha Rede por RPC recursiva baseada no plano.",
    "Paginar redes grandes e retornar somente campos necessarios.",
    "Usar a mesma fonte de plano na rede, calculadora e dashboard.",
    "Mostrar barra de progresso da ativacao mensal.",
    "Explicar por que cada comissao esta aguardando.",
    "Mostrar competencia prevista e avisos de Pix.",
    "Criar onboarding guiado e disponibilizar materiais oficiais.",
])]

# Roadmap
story += [PageBreak(), P("18. Ordem recomendada de execucao", "H1")]
story += [P("Fase 1 - integridade e seguranca", "H2")]
story += [numbered([
    "Provisionamento e ativacao idempotentes.",
    "Bloqueio de status ativo sem user_id/profile.",
    "Congelamento financeiro e momento correto da comissao.",
    "Autorizacao centralizada do portal e sessao bloqueada.",
    "Motor de ativacao mensal.",
    "Testes financeiros minimos.",
])]
story += [P("Fase 2 - regras comerciais e financeiro", "H2")]
story += [numbered([
    "Politica unica de atribuicao e cookie dinamico.",
    "Base de comissao.",
    "Versionamento de planos.",
    "Fluxo de alteracao de Pix.",
    "Lotes, conciliacao e estornos.",
])]
story += [P("Fase 3 - escala e experiencia", "H2")]
story += [numbered([
    "Consentimento e retencao.",
    "Protecao contra abuso.",
    "Observabilidade e alertas.",
    "Rede dinamica.",
    "UX, notificacoes e materiais.",
])]

story += [P("19. Decisoes comerciais antes do desenvolvimento", "H1")]
story += [callout(
    "Decisoes obrigatorias",
    "A implementacao deve comecar somente depois de a Bryza definir formalmente as quatro regras abaixo. Sem isso, o risco e automatizar uma politica que precisara ser refeita.",
    "warning"
)]
story += [data_table(
    ["Decisao", "Pergunta que precisa ser respondida"],
    [
        ("Ativacao mensal", "O que acontece com a comissao de quem nao cumpre R$ 79?"),
        ("Atribuicao", "First-touch, last-touch ou permanente depois da primeira compra?"),
        ("Adesao", "Todo comprador vira candidato ou precisa aceitar participar?"),
        ("Congelamento", "Em que momento o pedido deixa de poder alterar a comissao?"),
    ], [48 * mm, 122 * mm], font=8.2
)]

# Do not do + references
story += [PageBreak(), P("20. O que nao deve ser feito", "H1")]
story += [bullets([
    "Nao corrigir candidatos automaticos apenas adicionando um botao Ativar.",
    "Nao implementar ativacao mensal apagando comissoes.",
    "Nao editar valores historicos de comissao para corrigir divergencias.",
    "Nao usar service_role como substituto de RLS ou autorizacao.",
    "Nao permitir alteracao de Pix sem reautenticacao e trilha de auditoria.",
    "Nao publicar novo plano a cada alteracao de mensagem ou configuracao geral.",
    "Nao escalar marketing antes de testes de concorrencia e idempotencia.",
])]
story += [P("Referencias tecnicas principais", "H1")]
story += [bullets([
    "Supabase - Service role e RLS: https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z",
    "Supabase - User sessions: https://supabase.com/docs/guides/auth/sessions",
    "Supabase - Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security",
    "Supabase - Database functions e privilegios: https://supabase.com/docs/guides/database/functions",
])]
story += [P("Fontes locais revisadas", "H2")]
story += [bullets([
    "supabase/migrations/20260718044648_amb_multilevel_scheduling_commissions.sql",
    "supabase/migrations/20260718191617_ambassador_program_scalable_settings.sql",
    "supabase/migrations/20260718195356_first_purchase_referral_bonus.sql",
    "src/app/api/embaixadores/route.ts",
    "src/app/embaixadores/actions.ts",
    "src/app/embaixador/actions.ts",
    "src/lib/referral/cookie.ts",
    "scratch/test_amb_portal_security_suite.sql",
    "scratch/test_multilevel_scheduling_commissions.sql",
    "scratch/test_referral_tracking_security_suite.sql",
])]
story += [Spacer(1, 8 * mm)]
story += [callout("Proximo passo recomendado", "Transformar os itens P0 em especificacao tecnica e implementar em migrations pequenas, testadas e reversiveis, com validacao em ambiente de homologacao antes de qualquer uso financeiro real.", "success")]

doc = NumberedDocTemplate(
    str(OUT), pagesize=A4, leftMargin=M_LEFT, rightMargin=M_RIGHT,
    topMargin=M_TOP, bottomMargin=M_BOTTOM,
    title="Melhorias prioritarias do Programa de Embaixadores Bryza",
    author="Bryza",
    subject="Revisao tecnica, financeira e operacional"
)
doc.build(story)
print(OUT)
