# Pedido de chave da API — Registro de Imóveis do Brasil (registrodeimoveis.org.br / ONR)

**Onde enviar:** no portal registrodeimoveis.org.br, botão **"Solicitar chave de API"** (fica na calculadora de emolumentos).
Se o formulário tiver um campo curto, use o texto curto; se pedir uma descrição ou se a resposta vier por e-mail, use o texto completo.
Os campos entre colchetes você preenche antes de enviar.

---

## Texto curto (para o campo "finalidade" do formulário)

> Somos a [Tech4You], desenvolvedora de um sistema de due diligence imobiliária usado por escritórios de advocacia e imobiliárias.
> Queremos integrar o pedido de certidões de matrícula (inteiro teor e ônus reais) e o cálculo de emolumentos ao fluxo de análise
> documental de compra e venda de imóveis. Pedimos a chave de acesso e a documentação técnica da API, incluindo o ambiente de testes.

---

## Texto completo

**Assunto:** Solicitação de chave e documentação da API — integração para due diligence imobiliária

Prezados,

Somos a **[Tech4You — razão social, CNPJ]**, empresa que desenvolve um sistema web de **due diligence imobiliária** usado por
escritórios de advocacia e imobiliárias (inicialmente [TETTU / Macedo e Keenan / Redeplan]). O sistema monta o checklist de
documentos de um negócio de compra e venda de imóvel, recebe as certidões e gera um relatório preliminar para revisão do advogado.

Hoje as certidões de matrícula são pedidas manualmente no portal e anexadas ao sistema. Gostaríamos de fazer esse pedido pela API
oficial do Registro de Imóveis do Brasil, sempre a partir de um pedido feito pelo usuário, com os emolumentos pagos pelo canal oficial.

Para avaliar a integração, pedimos:

1. **Chave de acesso** à API (e, se houver, credenciais de um ambiente de homologação/sandbox).
2. **Documentação técnica**: autenticação, endpoints, formatos de requisição e resposta, códigos de erro e limites de uso.
3. Esclarecimento sobre o **escopo da API**. Em especial:
   - ela permite **pedir certidões** (matrícula em inteiro teor, ônus reais, vintenária) ou **apenas calcular emolumentos**?
   - permite **visualização de matrícula** e **pesquisa de bens** por CPF/CNPJ?
   - como o pedido é **acompanhado** (protocolo, consulta de status, aviso por webhook) e como a **certidão é entregue** (PDF assinado, link, XML)?
4. **Cobrança**: como os emolumentos e eventuais taxas de serviço são pagos quando o pedido vem pela API (cartão, boleto, conta pré-paga, faturamento do conveniado).
5. **Requisitos de credenciamento**: se é necessário convênio, contrato ou cadastro como empresa parceira, e quais documentos enviar.
6. **Termos de uso e LGPD**: regras de tratamento dos dados pessoais que constam das matrículas e das certidões, e de guarda dos documentos.

**Volume estimado:** [ex.: 30 a 100 pedidos de certidão por mês no início].

**Contato técnico:** [nome] — [e-mail] — [telefone].
**Contato comercial/responsável:** [nome] — [e-mail] — [telefone].

Ficamos à disposição para uma conversa técnica, se for o caminho mais rápido.

Atenciosamente,
[Nome]
[Cargo] — [Tech4You]

---

## Quando a resposta chegar

Guarde a documentação em `docs/` e me avise. A integração entra em `src/lib/certidoes/providers.ts` (provedor `registroImoveisProvider`,
funções `request` e `poll`), e as variáveis `REGISTRO_IMOVEIS_API_URL` e `REGISTRO_IMOVEIS_API_KEY` vão no `.env.local` e na Vercel.
Até lá o provedor continua desativado: não chamamos endpoints que não estejam documentados.
