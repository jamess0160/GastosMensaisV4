import { Link } from "react-router-dom";
import {
    LEGAL_CONTACT_EMAIL,
    LEGAL_VERSION,
    LegalCallout,
    LegalLayout,
    LegalSection,
} from "./LegalLayout";

/* ════════════════════════════════════════════════════════════
   Política de privacidade — `/privacidade`.

   As decisões que o texto carrega, tomadas em 10/09/2026 e registradas
   no plano da leva 7:

   - o controlador é PESSOA FÍSICA (Tiago Ribeiro). Não há CNPJ, e
     inventar um nome fantasia de empresa que não existe é pior do que
     assinar com o próprio nome;
   - o CPF vai OFUSCADO. O que a LGPD pede é que o controlador seja
     identificável — nome e canal bastam —, e o número inteiro numa
     página aberta e raspável é dado pessoal exposto sem ganho nenhum;
   - NÃO HÁ ENCARREGADO NOMEADO, e não precisa haver: a Resolução
     CD/ANPD nº 2/2022 dispensa a nomeação para agente de tratamento de
     pequeno porte, mantendo a obrigação do CANAL de comunicação.

   Como os termos, é documento de MVP: quando entrar cobrança, o
   processador de pagamento vira mais um operador aqui.
   ════════════════════════════════════════════════════════════ */

export function Privacy() {
    return (
        <LegalLayout
            title="Política de privacidade"
            intro={
                <>
                    Esta política explica quais dados o <strong>Gastos mensais</strong> coleta, para
                    que eles servem, com quem são compartilhados, por quanto tempo ficam guardados e
                    o que você pode exigir a respeito deles. Ela é parte integrante dos{" "}
                    <Link to="/termos">termos de uso</Link> e segue a Lei Geral de Proteção de Dados
                    (Lei nº 13.709/2018).
                </>
            }
        >
            <LegalSection id="controlador" number={1} title="Quem é o controlador dos dados">
                <LegalCallout>
                    <p>
                        O controlador é <strong>Tiago Ribeiro</strong>, pessoa física, inscrito no
                        CPF sob o nº <strong>***.456.789-**</strong>, desenvolvedor e mantenedor do
                        Gastos mensais.
                    </p>
                    <p>
                        Canal de contato para qualquer assunto relativo a dados pessoais:{" "}
                        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
                    </p>
                </LegalCallout>
                <p>
                    <strong>Não há encarregado (DPO) formalmente nomeado.</strong> A Resolução
                    CD/ANPD nº 2/2022 dispensa a nomeação para agentes de tratamento de pequeno
                    porte, mantendo a obrigação de oferecer um canal de comunicação com o titular. O
                    canal é o endereço de e-mail acima, e é ele que atende os pedidos descritos na
                    seção <a href="#direitos">Os seus direitos</a>.
                </p>
            </LegalSection>

            <LegalSection id="dados" number={2} title="Quais dados são coletados">
                <p>
                    Praticamente tudo o que o aplicativo sabe sobre você foi você quem digitou. Não
                    compramos listas, não cruzamos os seus dados com bases de terceiros e não
                    coletamos nada de outros sites.
                </p>
                <ul>
                    <li>
                        <strong>Dados de cadastro:</strong> nome, e-mail e telefone. O e-mail é
                        também o seu login e precisa ser único.
                    </li>
                    <li>
                        <strong>Senha:</strong> guardada apenas como <em>hash</em> (bcrypt).{" "}
                        <strong>A senha em si não é armazenada</strong> e não pode ser lida por
                        ninguém, nem por nós — por isso o caminho de esquecimento é criar uma senha
                        nova, e não receber a antiga.
                    </li>
                    <li>
                        <strong>Chaves de acesso (biometria/passkey), se você as cadastrar:</strong>{" "}
                        o identificador e a <em>chave pública</em> da credencial e um identificador
                        do navegador em que ela foi criada. A biometria em si (digital, rosto) fica
                        no seu aparelho e nunca chega até nós.
                    </li>
                    <li>
                        <strong>O conteúdo financeiro que você lança:</strong> gastos, parcelas,
                        entradas, transferências, contas, cartões, categorias, orçamentos, tags,
                        datas, valores, descrições e o rateio entre pessoas — inclusive os nomes das
                        pessoas que você cadastra para dividir despesas.
                    </li>
                    <li>
                        <strong>Dados do espaço de trabalho:</strong> o nome do espaço, quem são os
                        membros, o papel de cada um e os convites enviados (com o e-mail do
                        convidado).
                    </li>
                    <li>
                        <strong>Registros técnicos:</strong> data e hora de acesso, endereço IP,
                        identificador da conta e o detalhe de erros ocorridos no aplicativo. Servem
                        para investigar falhas e abusos, e o Marco Civil da Internet exige a guarda
                        de parte deles.
                    </li>
                </ul>
                <p>
                    <strong>O que não é coletado:</strong> não pedimos CPF, não pedimos número de
                    cartão, não guardamos senha de banco e{" "}
                    <strong>não nos conectamos às suas contas bancárias</strong>. O aplicativo não
                    importa extrato nem movimenta dinheiro — os valores que ele mostra são os que
                    você digitou.
                </p>
            </LegalSection>

            <LegalSection id="finalidades" number={3} title="Para que cada dado é usado">
                <ul>
                    <li>
                        <strong>Nome</strong> — identificar você dentro do aplicativo e para as
                        outras pessoas do seu espaço.
                    </li>
                    <li>
                        <strong>E-mail</strong> — autenticar o login, confirmar o cadastro,
                        recuperar a senha e enviar/receber convites de espaço.
                    </li>
                    <li>
                        <strong>Telefone</strong> — contato de suporte e recuperação de conta.
                    </li>
                    <li>
                        <strong>Hash da senha e credenciais de biometria</strong> — verificar que é
                        você que está entrando.
                    </li>
                    <li>
                        <strong>Conteúdo financeiro</strong> — prestar o serviço: calcular saldos,
                        orçamentos, parcelas, relatórios e o fechamento do mês, e exportar a
                        planilha quando você pedir.
                    </li>
                    <li>
                        <strong>Registros técnicos</strong> — segurança, prevenção a fraude e
                        correção de falhas.
                    </li>
                </ul>
                <p>
                    As <strong>bases legais</strong> são a execução do contrato entre você e o
                    serviço (art. 7º, V da LGPD) para tudo o que faz o aplicativo funcionar; o
                    cumprimento de obrigação legal (art. 7º, II) para a guarda dos registros de
                    acesso; e o legítimo interesse (art. 7º, IX) para segurança e prevenção a abuso.{" "}
                    <strong>Não usamos os seus dados para publicidade</strong>, não os vendemos, não
                    os cedemos e não fazemos perfilamento nem decisão automatizada sobre você.
                </p>
            </LegalSection>

            <LegalSection id="emails" number={4} title="Os e-mails que enviamos">
                <p>
                    São <strong>três</strong>, e só três: confirmação do endereço no cadastro,
                    recuperação de senha e convite para um espaço de trabalho. Todos são disparados
                    por uma ação — sua ou de quem convidou você.
                </p>
                <LegalCallout>
                    <p>
                        <strong>Não enviamos marketing.</strong> Não há newsletter, promoção,
                        novidade do produto nem “dica financeira”, e por isso não existe lista da
                        qual descadastrar. Se um dia isso mudar, será opcional e com consentimento
                        pedido antes.
                    </p>
                </LegalCallout>
            </LegalSection>

            <LegalSection
                id="compartilhamento"
                number={5}
                title="Com quem os dados são compartilhados"
            >
                <p>
                    <strong>Dentro do seu espaço de trabalho.</strong> Todo mundo que você convidar
                    para o espaço enxerga o conteúdo dele por inteiro: gastos, entradas, contas,
                    cartões, saldos, orçamentos, relatórios e o histórico anterior à entrada da
                    pessoa. É para isso que o espaço existe, e convidar alguém é uma decisão sua.
                    Fora do espaço, ninguém vê os seus lançamentos.
                </p>
                <p>
                    <strong>Operadores.</strong> Para funcionar, o serviço se apoia em dois
                    fornecedores, que tratam dados em nosso nome e apenas para as finalidades desta
                    política:
                </p>
                <ul>
                    <li>
                        <strong>Resend</strong> (Resend, Inc., Estados Unidos) — entrega dos e-mails
                        transacionais descritos acima. Recebe o endereço de destino e o conteúdo da
                        mensagem.
                    </li>
                    <li>
                        <strong>O provedor de infraestrutura</strong> em que a aplicação e o banco
                        de dados são hospedados, que mantém os servidores e as cópias de segurança.
                    </li>
                </ul>
                <LegalCallout>
                    <p>
                        <strong>O que isso implica no e-mail de recuperação de senha.</strong> O
                        corpo dessa mensagem contém o <em>link</em> que permite criar uma senha
                        nova, ou seja, ele <strong>é</strong> a credencial. Esse conteúdo fica
                        registrado nos <em>logs</em> do provedor de e-mail por um período, conforme
                        a política dele, e alguém com acesso a esses registros poderia usá-lo. É
                        justamente por isso que o link <strong>expira em 30 minutos</strong> e vale
                        uma <strong>única vez</strong>: usá-lo troca o hash da senha, e o próprio
                        link deixa de valer.
                    </p>
                </LegalCallout>
                <p>
                    <strong>Transferência internacional.</strong> O provedor de e-mail está sediado
                    nos Estados Unidos, o que caracteriza transferência internacional de dados (art.
                    33 da LGPD), limitada ao endereço de destino e ao conteúdo das três mensagens
                    acima — nenhum lançamento financeiro seu trafega por ele.
                </p>
                <p>
                    Fora isso, os dados só são fornecidos a terceiros por{" "}
                    <strong>ordem judicial ou requisição de autoridade competente</strong>, no
                    limite do que for exigido.
                </p>
            </LegalSection>

            <LegalSection id="cookies" number={6} title="Cookies e o que fica no seu navegador">
                <LegalCallout>
                    <p>
                        <strong>O único cookie do produto é o de sessão</strong> — chamado{" "}
                        <code>token</code>, marcado como <code>HttpOnly</code> e{" "}
                        <code>SameSite=Strict</code>. Ele guarda quem você é e em qual espaço você
                        está, e é <strong>necessário para o serviço funcionar</strong>: sem ele não
                        há como manter você conectado entre uma tela e outra.
                    </p>
                    <p>
                        <strong>
                            Não há cookie de rastreamento, de publicidade ou de análise de audiência
                        </strong>
                        , nem pixel de rede social, nem ferramenta de terceiro observando a sua
                        navegação. É por isso que este site não exibe banner de consentimento: não
                        há o que consentir além do que é indispensável.
                    </p>
                </LegalCallout>
                <p>
                    Além do cookie, o aplicativo guarda algumas coisas{" "}
                    <strong>no seu próprio navegador</strong>, que nunca são enviadas para lugar
                    nenhum: um identificador do aparelho (usado só se você cadastrar biometria), o
                    mês que você está olhando (por aba) e o rascunho de um formulário que ficou pela
                    metade. Limpar os dados do navegador apaga tudo isso.
                </p>
            </LegalSection>

            <LegalSection id="retencao" number={7} title="Por quanto tempo os dados ficam">
                <p>
                    Os dados da conta e os lançamentos ficam guardados{" "}
                    <strong>enquanto a sua conta existir</strong> — é o que permite comparar o mês
                    de hoje com o do ano passado. Os registros técnicos de erro têm vida curta
                    (hoje, sete dias); os registros de acesso são guardados pelo prazo do Marco
                    Civil da Internet.
                </p>
                <p>
                    <strong>Ao encerrar a conta</strong> pela tela de Perfil, o que acontece é isto:
                </p>
                <ul>
                    <li>
                        <strong>a sua linha de usuário é apagada</strong>, não desativada: nome,
                        e-mail, telefone e hash da senha somem do banco;
                    </li>
                    <li>
                        <strong>os espaços em que você era a única pessoa somem inteiros</strong>,
                        com contas, gastos, entradas, categorias e orçamentos;
                    </li>
                    <li>
                        <strong>as suas matrículas em espaços de outras pessoas somem</strong>, e o
                        espaço continua existindo para quem ficou;
                    </li>
                    <li>
                        <strong>
                            os lançamentos que você criou em espaços de terceiros permanecem, sem
                            autor.
                        </strong>{" "}
                        O dinheiro do mês de quem ficou não pode mudar porque outra pessoa encerrou
                        a conta — e o mesmo vale para a “pessoa” do rateio, que continua no espaço,
                        desligada da sua conta, para não reescrever o histórico de quem gastou o
                        quê;
                    </li>
                    <li>
                        se você for dono de um espaço com outros membros, o encerramento é{" "}
                        <strong>recusado</strong> até que você transfira a propriedade ou remova os
                        demais — é o que impede que a sua saída apague os dados de outra pessoa.
                    </li>
                </ul>
                <p>
                    Cópias de segurança da base podem conter dados já apagados por um período curto,
                    até serem sobrescritas pelo ciclo normal de retenção.{" "}
                    <strong>Exporte a sua planilha antes de encerrar a conta</strong>: depois não há
                    como recuperar.
                </p>
            </LegalSection>

            <LegalSection id="seguranca" number={8} title="Segurança">
                <p>
                    A senha é guardada apenas como hash, o tráfego é cifrado por HTTPS, o cookie de
                    sessão não é legível por JavaScript (<code>HttpOnly</code>) e não viaja para
                    outros sites (<code>SameSite=Strict</code>), e cada requisição verifica se você
                    pode ver aquele espaço antes de responder qualquer coisa.
                </p>
                <p>
                    Ainda assim, nenhum sistema é imune. Se ocorrer um incidente de segurança que
                    possa acarretar risco ou dano relevante a você, comunicaremos o fato e a ANPD,
                    como manda o art. 48 da LGPD.
                </p>
            </LegalSection>

            <LegalSection id="direitos" number={9} title="Os seus direitos">
                <p>
                    O art. 18 da LGPD garante a você, a qualquer momento e gratuitamente, o direito
                    de obter:
                </p>
                <ul>
                    <li>a confirmação de que tratamos dados seus e o acesso a eles;</li>
                    <li>a correção de dados incompletos, inexatos ou desatualizados;</li>
                    <li>
                        a anonimização, o bloqueio ou a eliminação de dados desnecessários,
                        excessivos ou tratados em desconformidade com a lei;
                    </li>
                    <li>a portabilidade dos dados a outro fornecedor, mediante requisição;</li>
                    <li>
                        a eliminação dos dados tratados com base no seu consentimento, ressalvadas
                        as hipóteses de guarda previstas em lei;
                    </li>
                    <li>a informação sobre com quem os seus dados foram compartilhados;</li>
                    <li>a revogação do consentimento, quando essa for a base legal.</li>
                </ul>
                <p>
                    <strong>Boa parte disso você faz sozinho, na hora:</strong> corrigir nome,
                    e-mail e telefone na tela de Perfil; baixar todo o seu histórico em planilha
                    pela exportação; e apagar a conta pela própria tela de Perfil. Para o que não
                    estiver na tela, escreva para{" "}
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> —
                    respondemos no menor prazo possível, e em até 15 dias nos casos em que a lei
                    fixa esse prazo. Podemos pedir informações que confirmem a sua identidade antes
                    de atender a um pedido, justamente para não entregar os seus dados a outra
                    pessoa.
                </p>
                <p>
                    Você também pode peticionar diretamente à{" "}
                    <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> se entender que
                    algum direito seu não foi respeitado.
                </p>
            </LegalSection>

            <LegalSection id="menores" number={10} title="Crianças e adolescentes">
                <p>
                    O serviço é destinado a maiores de 18 anos e não coleta dados de crianças e
                    adolescentes de forma intencional. Se identificarmos uma conta criada por menor
                    de idade, ela será encerrada e os dados, eliminados. Responsáveis que suspeitem
                    disso podem nos avisar pelo canal de contato.
                </p>
            </LegalSection>

            <LegalSection id="mudancas" number={11} title="Mudanças nesta política">
                <p>
                    Esta política pode ser atualizada — inclusive porque o serviço está em
                    desenvolvimento e novos recursos podem tratar dados novos. A data no topo desta
                    página (<strong>{LEGAL_VERSION}</strong>) é a versão vigente, e é ela que fica
                    registrada quando você aceita.
                </p>
                <p>
                    Mudanças relevantes — uma finalidade nova, um operador novo — são avisadas
                    dentro do aplicativo antes de passarem a valer. Trocar o endereço de contato
                    acima também é mudar este documento, e gera uma versão nova.
                </p>
            </LegalSection>

            <LegalSection id="contato" number={12} title="Contato">
                <p>
                    Dúvida, pedido de acesso, correção ou exclusão, ou qualquer assunto relativo aos
                    seus dados pessoais:{" "}
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. É uma caixa
                    lida por uma pessoa — a mesma que mantém o Gastos mensais.
                </p>
            </LegalSection>
        </LegalLayout>
    );
}
