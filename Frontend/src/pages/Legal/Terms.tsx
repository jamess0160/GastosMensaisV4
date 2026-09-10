import { Link } from "react-router-dom";
import {
    LEGAL_CONTACT_EMAIL,
    LEGAL_VERSION,
    LegalCallout,
    LegalLayout,
    LegalSection,
} from "./LegalLayout";

/* ════════════════════════════════════════════════════════════
   Termos de uso — `/termos`.

   O texto é JSX, e não markdown carregado em runtime: são dois
   documentos que mudam de ano em ano, e uma biblioteca de markdown mais
   um fetch para resolver isso custa mais do que o problema.

   ESTE É UM DOCUMENTO DE MVP. O lançamento é para conhecidos testarem,
   de graça, sem plano e sem pagamento. Quando entrar cobrança ele
   precisa ser revisto ANTES: muda o controlador (o CNPJ assina no lugar
   da pessoa física) e entram pagamento, reembolso e cancelamento de
   assinatura. Nada disso é ajuste de redação.
   ════════════════════════════════════════════════════════════ */

export function Terms() {
    return (
        <LegalLayout
            title="Termos de uso"
            intro={
                <>
                    Estes termos regem o uso do <strong>Gastos mensais</strong>, um aplicativo web
                    para organizar os gastos e as entradas do mês. Ao criar uma conta você declara
                    que leu e aceita o que está escrito aqui e na{" "}
                    <Link to="/privacidade">política de privacidade</Link>. Se não concordar com
                    alguma parte, não crie a conta — e, se já tiver criado, você pode encerrá-la a
                    qualquer momento pelo próprio aplicativo.
                </>
            }
        >
            <LegalSection id="o-servico" number={1} title="O que é o Gastos mensais">
                <p>
                    O Gastos mensais é uma ferramenta de <strong>registro e organização</strong> do
                    dinheiro que você mesmo lança: gastos, parcelas, entradas, contas, cartões,
                    orçamentos e o rateio entre as pessoas do seu espaço. Ele soma, agrupa e mostra
                    o que você digitou, em relatórios e no fechamento do mês.
                </p>
                <LegalCallout>
                    <p>
                        <strong>O Gastos mensais não é consultoria financeira.</strong> Nenhum
                        número, gráfico, saldo, projeção ou alerta exibido na tela é recomendação de
                        investimento, de crédito, de compra ou de qualquer decisão financeira. Não
                        somos instituição financeira, corretora, correspondente bancário nem
                        consultor de investimentos, e não temos autorização de nenhum órgão
                        regulador para atuar como tal. As decisões sobre o seu dinheiro são suas, e
                        a responsabilidade por elas também.
                    </p>
                </LegalCallout>
                <p>
                    O aplicativo também <strong>não movimenta dinheiro</strong>: ele não paga
                    contas, não transfere valores, não emite boleto e não se conecta às suas contas
                    bancárias ou aos seus cartões para importar lançamentos. Quitar um gasto aqui
                    significa marcar no aplicativo que ele foi pago — o pagamento de verdade
                    acontece no seu banco.
                </p>
            </LegalSection>

            <LegalSection id="conta" number={2} title="A sua conta">
                <p>
                    A conta é <strong>pessoal e intransferível</strong>. Ao criar uma conta você se
                    compromete a informar dados verdadeiros, a manter o e-mail de cadastro
                    atualizado e a guardar a sua senha em segredo. Tudo o que for feito com a sua
                    senha, ou com um dispositivo em que você deixou a sessão aberta, é tratado como
                    feito por você.
                </p>
                <p>
                    O serviço é destinado a <strong>maiores de 18 anos</strong>. Não criamos contas
                    para crianças e adolescentes e não coletamos dados deles de forma intencional.
                </p>
                <p>
                    Se você desconfiar de acesso indevido, troque a senha imediatamente pela tela de
                    Perfil e nos avise em{" "}
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Você também
                    pode revogar as chaves de acesso (biometria/passkey) cadastradas nos seus
                    aparelhos pela mesma tela.
                </p>
            </LegalSection>

            <LegalSection id="espaco" number={3} title="O espaço compartilhado e os convites">
                <p>
                    Os lançamentos não vivem na conta, e sim num <strong>espaço de trabalho</strong>
                    . Todo cadastro nasce com um espaço próprio, e você pode convidar outras pessoas
                    para o seu — é assim que um casal, uma família ou dois sócios usam o aplicativo
                    juntos.
                </p>
                <p>Ao convidar alguém, entenda o que isso significa:</p>
                <ul>
                    <li>
                        <strong>Quem entra vê tudo o que há no espaço</strong> — gastos, entradas,
                        contas, cartões, saldos, orçamentos e o histórico inteiro, inclusive o que
                        foi lançado antes de a pessoa chegar. Não existe lançamento privado dentro
                        de um espaço compartilhado.
                    </li>
                    <li>
                        O convidado entra como <strong>editor</strong> (pode lançar e editar) ou
                        como <strong>consulta</strong> (só lê). O papel pode ser trocado depois pelo
                        dono do espaço.
                    </li>
                    <li>
                        O <strong>dono do espaço</strong> é quem convida, remove membros, renomeia o
                        espaço e pode transferir a propriedade para outro membro.
                    </li>
                    <li>
                        O convite é enviado para um endereço de e-mail específico e só serve para
                        ele. Convidar alguém é uma decisão sua, e é você quem responde por ela.
                    </li>
                </ul>
                <p>
                    Sair de um espaço, ou ser removido dele, tira o seu acesso ao conteúdo dele — os
                    lançamentos continuam com quem ficou.
                </p>
            </LegalSection>

            <LegalSection id="conteudo" number={4} title="O que você lança é responsabilidade sua">
                <p>
                    Todo o conteúdo do aplicativo é digitado por você ou pelas pessoas do seu
                    espaço. Você é o responsável pela <strong>exatidão</strong> desses dados e pelas
                    consequências de lançá-los errado: um valor digitado a mais, uma parcela
                    esquecida ou uma data trocada aparecem nos relatórios exatamente como foram
                    informados.
                </p>
                <p>
                    Ao lançar dados de <strong>outras pessoas</strong> — o nome de quem dividiu a
                    conta, por exemplo — você declara que pode fazê-lo. Não lance dados sensíveis
                    que não sirvam ao propósito do aplicativo, e não use o serviço para nada
                    ilícito, para violar direito de terceiro ou para armazenar conteúdo que você não
                    tem autorização de guardar.
                </p>
                <p>
                    Também não é permitido tentar burlar a autenticação, acessar espaço de outra
                    pessoa, sobrecarregar o serviço com automação, extrair dados em massa ou
                    explorar falhas encontradas. Se encontrar uma falha,{" "}
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>nos avise</a> — agradecemos de
                    verdade.
                </p>
            </LegalSection>

            <LegalSection
                id="disponibilidade"
                number={5}
                title="Disponibilidade, garantias e limites"
            >
                <LegalCallout>
                    <p>
                        <strong>
                            O serviço está em desenvolvimento e é oferecido gratuitamente, no estado
                            em que se encontra.
                        </strong>{" "}
                        Não há garantia de disponibilidade, de ausência de erros nem de preservação
                        dos dados. Ele pode ficar fora do ar para manutenção, mudar de
                        funcionamento, ganhar e perder funcionalidades sem aviso prévio.
                    </p>
                </LegalCallout>
                <p>
                    Fazemos o que está ao nosso alcance para manter o serviço no ar e os dados
                    íntegros, mas <strong>não assumimos obrigação de resultado</strong> quanto a
                    isso. Guarde uma cópia do que for importante: o aplicativo exporta todo o seu
                    histórico em planilha, a qualquer momento, pela sidebar e pela tela de
                    Relatório.
                </p>
                <p>
                    Na medida máxima permitida pela lei, não respondemos por lucros cessantes, perda
                    de oportunidade, decisões financeiras tomadas com base nos números exibidos, nem
                    por indisponibilidade do serviço. Nada aqui afasta os direitos que o Código de
                    Defesa do Consumidor garante a você.
                </p>
            </LegalSection>

            <LegalSection id="encerramento" number={6} title="Encerrar a conta">
                <p>
                    <strong>Você pode encerrar a sua conta a qualquer momento</strong>, sem pedir
                    autorização e sem falar com ninguém: a opção fica na tela de{" "}
                    <strong>Perfil</strong>, e para confirmar pedimos a sua senha, porque a ação é
                    irreversível.
                </p>
                <p>
                    Ao encerrar, os espaços em que você era a <strong>única</strong> pessoa são
                    apagados inteiros, com contas, gastos, entradas, categorias e orçamentos. Se
                    você for dono de um espaço que tem outras pessoas, o aplicativo pede que você
                    antes <strong>transfira a propriedade</strong> ou remova os demais membros — é o
                    que impede que o encerramento da sua conta apague os dados de outra pessoa. O
                    detalhe do que é apagado, do que fica e do que fica sem autor está na{" "}
                    <Link to="/privacidade#retencao">política de privacidade</Link>.
                </p>
                <p>
                    Do nosso lado, podemos suspender ou encerrar uma conta que use o serviço para
                    fraude, para ato ilícito ou de forma que ameace a segurança e o funcionamento do
                    aplicativo para as demais pessoas. Quando não houver risco de agravar a
                    situação, avisamos antes e damos a chance de exportar os dados.
                </p>
            </LegalSection>

            <LegalSection id="privacidade" number={7} title="Dados pessoais">
                <p>
                    O tratamento dos seus dados pessoais está descrito na{" "}
                    <Link to="/privacidade">política de privacidade</Link>, que é parte integrante
                    destes termos. Vale destacar duas coisas de lá: o e-mail cadastrado é usado
                    apenas para confirmação de cadastro, recuperação de senha e convites —{" "}
                    <strong>nunca para marketing</strong> — e o único cookie do produto é o de
                    sessão, necessário para o aplicativo funcionar.
                </p>
            </LegalSection>

            <LegalSection id="mudancas" number={8} title="Mudanças nestes termos">
                <p>
                    Estes termos podem mudar — para descrever funcionalidades novas, para corrigir o
                    que ficou impreciso ou para se adequar à lei. A data no topo desta página (
                    <strong>{LEGAL_VERSION}</strong>) é a versão vigente, e é ela que fica
                    registrada quando você aceita.
                </p>
                <p>
                    Quando a mudança for relevante, avisamos dentro do aplicativo e, se for o caso,
                    pedimos um novo aceite. Continuar usando o serviço depois de uma mudança
                    comunicada significa concordar com a versão nova. Se não concordar, você pode
                    encerrar a conta.
                </p>
            </LegalSection>

            <LegalSection id="lei" number={9} title="Lei aplicável e foro">
                <p>
                    Estes termos são regidos pelas <strong>leis brasileiras</strong>, em especial
                    pelo Código de Defesa do Consumidor (Lei nº 8.078/1990), pelo Marco Civil da
                    Internet (Lei nº 12.965/2014) e pela Lei Geral de Proteção de Dados (Lei nº
                    13.709/2018).
                </p>
                <p>
                    Fica eleito o <strong>foro do domicílio do usuário</strong> para resolver
                    qualquer controvérsia decorrente destes termos. Antes disso, porém, escreva para{" "}
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>: quase tudo
                    se resolve por e-mail.
                </p>
            </LegalSection>

            <LegalSection id="contato" number={10} title="Contato">
                <p>
                    O Gastos mensais é mantido por <strong>Tiago Ribeiro</strong>, pessoa física,
                    CPF <strong>***.456.789-**</strong>. Para dúvidas, suporte, exercício de
                    direitos ou qualquer assunto relacionado a estes termos, o canal é{" "}
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
                </p>
            </LegalSection>
        </LegalLayout>
    );
}
