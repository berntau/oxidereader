# Fase 1 — Fundamentos de I/O, Bytes e Erros

> Objetivo real desta fase: ao final, você abre um `.epub`, confirma que ele é
> mesmo um ZIP lendo os 4 primeiros bytes, e trata todos os erros com um tipo
> próprio. São ~60 linhas de Rust. Se você fizer em 2 horas, foi rápido demais.

---

## Como estudar esta fase

Rust é uma linguagem em que **o compilador é o professor**. A técnica abaixo
existe para te colocar em conversa com ele, em vez de contornar ele.

Cada passo segue sempre o mesmo ciclo de 5 etapas:

| | Etapa | O que fazer |
| :-- | :--- | :--- |
| 1 | **Preveja** | Antes de rodar, escreva sua aposta do que vai acontecer. Em voz alta ou num `notas.md`. |
| 2 | **Escreva** | Código mínimo, digitado por você. Nunca cole o que não sabe explicar. |
| 3 | **Quebre** | Estrague de propósito, do jeito indicado. Leia o erro **inteiro**. |
| 4 | **Explique** | Feche o editor. Explique em voz alta o que aprendeu, sem olhar. |
| 5 | **Verifique** | Responda o checkpoint. Só abra a resposta depois de tentar. |

### As três regras que fazem a diferença

**1. Preveja antes de rodar.** Esta é a técnica mais importante do documento.
Seu objetivo nesta fase não é fazer o código funcionar — é construir um modelo
mental do borrow checker. Você só descobre que seu modelo está errado quando
prevê "isso vai compilar" e não compila. Se você roda sem prever, o compilador
vira um corretor ortográfico e você não aprende nada. Acertar a previsão vale
mais que acertar o código.

**2. Leia a mensagem de erro inteira, em voz alta, antes de tocar no código.**
Erros do `rustc` têm três partes: o `error[EXXXX]`, as setas `-->` apontando o
local, e — a parte que todo mundo pula — as seções `note:` e `help:`. O `help:`
frequentemente contém a correção literal. Pular isso e sair tentando coisas é o
jeito mais rápido de passar 40 minutos num erro de 10 segundos.

**3. Quebre de propósito.** O currículo de Rust *são* as mensagens de erro. Cada
passo abaixo tem um "Quebre" — não é enfeite, é a parte mais densa do
aprendizado. Código que funciona de primeira ensina pouco.

> Se você travar de verdade por mais de 20 minutos num passo, pergunte. Travar é
> parte do processo; ficar travado não é.

---

## 1.1 — Receber o caminho do arquivo pela linha de comando

**Conceitos:** `std::env::args`, `Vec<T>`, `String` vs `&str`, stack vs heap.

### Preveja

Antes de escrever qualquer coisa, responda:

- `std::env::args()` devolve os argumentos. Quantos itens você espera ao rodar
  `cargo run -- livro.epub`? Um ou dois?
- Esses itens são `String` ou `&str`? Por quê? (dica: de quem é a memória?)

### Escreva

1. Colete os argumentos num `Vec<String>`. Procure por `.collect()` — você vai
   precisar dizer ao compilador qual coleção quer.
2. Imprima o vetor inteiro com `{:?}` (o *debug format*) e confirme sua previsão.
3. Pegue o argumento do caminho e imprima só ele.

Docs: [`std::env::args`](https://doc.rust-lang.org/std/env/fn.args.html)

### Quebre

Faça os três, um de cada vez, e leia o erro completo:

- **a)** Rode `cargo run` sem nenhum argumento, acessando `args[1]` direto.
  Veja o *panic*. Depois rode de novo com `RUST_BACKTRACE=1 cargo run`.
- **b)** Troque o acesso por índice (`args[1]`) por `.get(1)`. O tipo mudou —
  que tipo é agora? Por que ele existe?
- **c)** Escreva `let caminho: &str = args[1];`. Leia o erro de tipo com atenção:
  `expected &str, found String`. O `help:` te dá a correção.

### Explique

Sem olhar: por que `args()` te dá `String` e não `&str`? Onde moram os bytes
desse texto?

### Checkpoint

<details>
<summary>Por que <code>args[0]</code> não é o seu arquivo?</summary>

Por convenção do sistema operacional, o argumento 0 é o caminho do próprio
executável (`target/debug/oxide-reader`). Seus argumentos começam no índice 1.
Também por isso o `--` em `cargo run -- livro.epub` é necessário: ele separa os
argumentos do `cargo` dos argumentos do *seu* programa.
</details>

<details>
<summary>Qual a diferença entre <code>args[1]</code> e <code>args.get(1)</code>?</summary>

`args[1]` entra em *panic* se o índice não existir — a decisão é "se não tem, o
programa morre". `args.get(1)` devolve `Option<&String>`: `Some(x)` ou `None`,
te **obrigando** a decidir o que fazer no caso vazio. Rust não tem `null`;
`Option<T>` é como a ausência é representada, e ela é visível no tipo. Esse é o
primeiro exemplo de um padrão que você vai ver o resto da vida em Rust: o tipo
carrega a possibilidade de falha, então você não consegue esquecer dela.
</details>

<details>
<summary><code>String</code> vs <code>&str</code>, afinal</summary>

`String` é **dona** dos bytes: eles moram na heap, ela pode crescer, e quando ela
sai de escopo a memória é liberada. `&str` é uma **referência emprestada** a
bytes que pertencem a outra pessoa — não pode crescer e não libera nada.

`args()` precisa te dar `String` porque ela *aloca* esse texto na hora (veio do
SO, não existia no seu binário). Não haveria dono para um `&str` apontar.

A mesma dupla reaparece em todo lugar: `String`/`&str`, `Vec<T>`/`&[T]`,
`PathBuf`/`&Path`. Dono e empréstimo. Guarde esse par — o 1.2 usa ele de novo.
</details>

---

## 1.2 — Abrir o arquivo e inspecionar metadados

**Conceitos:** `std::fs::File`, `Path`/`PathBuf`, `Result<T, E>`, `#[must_use]`.

### Preveja

- `File::open("naoexiste.epub")` — o que isso devolve? Um `File`? E se o arquivo
  não existir, como o Rust te conta isso, sem exceções?
- Lembrando o par dono/empréstimo do 1.1: `Path` é o dono ou o emprestado?

### Escreva

1. Abra o arquivo com [`std::fs::File::open`](https://doc.rust-lang.org/std/fs/struct.File.html#method.open).
   Resolva o `Result` com `.expect("mensagem útil")` por enquanto — vamos
   melhorar isso no 1.3.
2. Pegue o tamanho em bytes via `.metadata()` e `.len()`. Repare que `metadata()`
   também devolve um `Result`.
3. Imprima: `livro.epub — 412.981 bytes`.

### Quebre

- **a)** Escreva só `File::open(caminho);` e ignore o retorno. Não é erro — é um
  *warning*. Leia: `unused_result`. Por que o Rust se importa?
- **b)** Aponte para um arquivo que não existe e rode. Leia a mensagem de panic
  completa: `No such file or directory (os error 2)`.
- **c)** Troque o `.expect(...)` por um `match` com os braços `Ok(f)` e `Err(e)`,
  imprimindo o erro no braço `Err`. Isso é o que o `.expect()` fazia por você.

### Explique

O que é um `Result<T, E>`, estruturalmente? (Não "é um resultado" — o que ele
*é* em termos de tipo?)

### Checkpoint

<details>
<summary>O que <code>Result</code> realmente é</summary>

É um `enum` comum, com dois variantes:

```rust
enum Result<T, E> { Ok(T), Err(E) }
```

Não tem mágica nem palavra-chave. Não existe `try`/`catch`, não existe uma pilha
de exceções desenrolando por baixo dos panos — a falha é só um valor que a função
te devolve, e o sistema de tipos te obriga a abrir a caixa antes de usar o que
tem dentro. Toda a diferença está aí: um erro em Rust é um dado, não um
desvio de fluxo invisível.
</details>

<details>
<summary><code>Path</code>, <code>PathBuf</code> e por que não usar <code>String</code></summary>

`PathBuf` é o dono (heap, cresce), `&Path` é o emprestado — exatamente o par do
1.1. São tipos separados de `String` porque caminhos nem sempre são UTF-8 válido:
Linux permite qualquer sequência de bytes num nome de arquivo, menos `/` e nulo.
`Path` existe para representar isso honestamente.

(Mesmo motivo de `env::args()` ter uma irmã `args_os()`: a versão que você usou
entra em *panic* com argumentos que não sejam Unicode válido. Para este projeto
está ótimo — mas agora você sabe por que a outra existe.)
</details>

---

## 1.3 — Erros de verdade: `?`, `From` e um `EpubError` próprio

**Conceitos:** o operador `?`, propagação, `thiserror`, trait `From`.

Este é o passo mais importante da fase. Faça na ordem — a ordem é a lição.

### Primeiro: sinta a dor

1. Faça `main` devolver `Result<(), std::io::Error>`. Sim, `main` pode devolver
   `Result`. Lembre de terminar com `Ok(())`.
2. Agora troque todos os `.expect(...)` por `?`. Veja quanto ruído sumiu.
3. **Agora o ponto:** adicione uma validação que produz um erro *que não é*
   `io::Error` — por exemplo, devolver erro se a extensão não for `.epub`. Tente
   propagar com `?`.

Não vai compilar. Esse erro é o passo inteiro — leia com calma. O `?` sabe
converter erro-de-origem em erro-de-retorno, mas ninguém ensinou a ele como
transformar o seu erro novo em `io::Error`.

### Depois: resolva

4. `cargo add thiserror` (sua primeira dependência — repare no que muda no
   `Cargo.toml` e no `Cargo.lock`).
5. Crie um `enum EpubError` com `#[derive(Error, Debug)]`, um `#[error("...")]`
   em cada variante, e variantes para: erro de I/O, extensão inválida, e
   assinatura de arquivo inválida (essa última o 1.4 usa).
6. Na variante de I/O, use `#[from] std::io::Error`.
7. Troque o retorno de `main` para `Result<(), EpubError>`. Os `?` voltam a
   funcionar — nos dois tipos de erro.

Docs: [`thiserror`](https://docs.rs/thiserror/latest/thiserror/)

### Quebre

- **a)** Tire o `#[from]` da variante de I/O e recompile. O erro é
  `the trait bound 'EpubError: From<std::io::Error>' is not satisfied`.
  **Essa frase é a lição inteira do passo** — leia duas vezes.
- **b)** Tire o `#[error("...")]` de uma variante. Veja o que o `thiserror`
  reclama.
- **c)** Use `?` dentro de uma função que devolve `()` em vez de `Result`. Leia o
  erro — ele explica exatamente o que o `?` precisa para existir.

### Explique

O que o `?` faz, em três passos, quando o valor é `Err`?

### Checkpoint

<details>
<summary>Como o <code>?</code> funciona por baixo</summary>

`let f = File::open(p)?;` é, aproximadamente:

```rust
let f = match File::open(p) {
    Ok(v) => v,
    Err(e) => return Err(From::from(e)),
};
```

Três passos: **(1)** se for `Ok`, extrai o valor e segue; **(2)** se for `Err`,
retorna imediatamente da função; **(3)** e no caminho da saída chama
`From::from(e)` para converter o erro ao tipo que a função declara retornar.

É o passo 3 que explica tudo que você viu neste tópico: o `#[from]` do
`thiserror` só gera essa implementação de `From` para você. Sem ela, o `?` não
tem como converter, e o compilador te conta exatamente isso.
</details>

<details>
<summary><code>thiserror</code> ou <code>anyhow</code>?</summary>

`thiserror` cria um tipo de erro **específico e inspecionável** — quem chama
consegue dar `match` nas variantes e reagir diferente a cada uma. É o certo para
bibliotecas e para o núcleo de um projeto.

`anyhow` oferece um único tipo "qualquer erro, com contexto", ótimo para a borda
de aplicações onde você só vai imprimir a mensagem e sair.

Como o parser de EPUB é a biblioteca do seu projeto, `thiserror` é a escolha
certa aqui. Mais pra frente, quando o `main` virar só orquestração, usar `anyhow`
lá na ponta é um padrão comum — e perfeitamente combinável.
</details>

---

## 1.4 — Ler os *magic bytes* e confirmar que é um ZIP

**Conceitos:** `&[u8]`, arrays de tamanho fixo, `BufReader`, trait `Read`,
mutabilidade explícita.

Um `.epub` é um ZIP renomeado. Todo ZIP começa com os bytes `PK\x03\x04` — "PK"
de Phil Katz, o criador do formato.

### Preveja

- `let mut buf = [0u8; 4];` — isso mora na stack ou na heap? E o `Vec` do 1.1?
- Para preencher esse buffer, a função vai precisar de `&buf` ou `&mut buf`?

### Escreva

1. Envolva o `File` num [`BufReader`](https://doc.rust-lang.org/std/io/struct.BufReader.html).
2. Declare um array de 4 bytes zerados.
3. Preencha com [`read_exact`](https://doc.rust-lang.org/std/io/trait.Read.html#method.read_exact).
4. Compare com `b"PK\x03\x04"` (um *byte string literal*) e devolva sua variante
   de erro de assinatura inválida se não bater.
5. Teste com o `.epub` de verdade **e** com um arquivo de texto qualquer
   renomeado para `.epub`.

### Quebre

- **a)** Esqueça o `use std::io::Read;`. O erro dirá que o método não existe,
  **e** que o trait existe mas não está em escopo. Em Rust, métodos de trait só
  aparecem quando o trait está importado.
- **b)** Tire o `mut` do buffer. Leia: `cannot borrow as mutable`. Mutabilidade
  em Rust é explícita e faz parte do tipo da referência.
- **c)** Troque `read_exact` por `read`. Compila? Qual a diferença no retorno, e
  por que `read` pode te dar menos bytes do que você pediu?

### Explique

Por que `read_exact` quer `&mut [u8]` em vez de devolver um `Vec<u8>` novo?

### Checkpoint

<details>
<summary>Array <code>[u8; 4]</code> vs <code>Vec&lt;u8&gt;</code></summary>

`[u8; 4]` tem tamanho conhecido **em tempo de compilação**: são 4 bytes na stack,
zero alocação, e o tamanho faz parte do tipo (`[u8; 4]` e `[u8; 5]` são tipos
diferentes). `Vec<u8>` tem tamanho decidido em tempo de execução, mora na heap e
pode crescer.

Para 4 bytes de assinatura, o array é exatamente certo: você sabe que são 4,
sempre. Essa escolha — "o tamanho é conhecido agora ou depois?" — decide stack vs
heap em quase todo Rust que você vai escrever.
</details>

<details>
<summary>Por que <code>&mut [u8]</code> em vez de retornar um <code>Vec</code></summary>

Porque quem chama decide onde a memória mora. `read_exact` escreve no seu buffer
sem alocar nada; num laço que lê milhares de blocos, você reaproveita o mesmo
buffer em vez de alocar um `Vec` por iteração. É o padrão de I/O de performance
em Rust — e a razão de a assinatura pedir `&mut`: ela precisa de permissão para
*escrever* na sua memória, e o tipo deixa isso explícito.
</details>

<details>
<summary>E o <code>BufReader</code> pra ler só 4 bytes?</summary>

Honestamente: para 4 bytes, não serve pra nada — é uma syscall de qualquer jeito.
Está aí porque na fase 2 o `zip::ZipArchive` vai querer um leitor com `Read +
Seek`, e você já terá o hábito.

Vale saber o que ele faz de verdade: sem buffer, cada `read` pequeno vira uma
chamada ao sistema operacional, que é cara. O `BufReader` lê um bloco grande de
uma vez e serve suas leituras pequenas a partir da memória. Com leituras de 4
bytes num laço, a diferença é ordens de magnitude.
</details>

---

## Fechamento da fase

### Revisão espaçada

Faça isto **no dia seguinte**, não hoje. Sem abrir o código, responda:

1. Por que `env::args()` devolve `String` e não `&str`?
2. Quais os três passos do `?` quando o valor é `Err`?
3. Que par de tipos se repete em `String`/`&str`, `Vec<T>`/`&[T]` e
   `PathBuf`/`&Path`? O que distingue os dois lados?
4. Quando um dado vai pra stack e quando vai pra heap?

Ficar travado em alguma delas é sinal de onde voltar — não de fracasso. Esse é o
objetivo do exercício.

### Critério de conclusão

- [ ] `cargo run -- livro.epub` imprime nome e tamanho
- [ ] `cargo run` sem argumento falha com mensagem clara, sem *panic*
- [ ] Um `.txt` renomeado para `.epub` é rejeitado pela assinatura
- [ ] Nenhum `.unwrap()` ou `.expect()` sobrou no código
- [ ] Você consegue explicar **cada linha** sem consultar nada

O último item é o único que importa de verdade.

### Antes de ir pra fase 2

Compare sua solução com a do branch `reference/agent-version`
(`git show reference/agent-version:src/main.rs`). Só agora — comparar antes de
resolver desperdiça o exercício inteiro.

Ao comparar, a pergunta útil não é "quem acertou", é **"onde a escolha foi
diferente, e por quê?"**. Diferença de estrutura de erro, de onde a validação
mora, de quando alocar. Você vai encontrar coisas suas que ficaram melhores.
