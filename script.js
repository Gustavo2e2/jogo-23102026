// ===== Elementos do HTML =====
const cenario = document.getElementById('cenario');
const nave = document.getElementById('nave');
const frota = document.querySelector('.frota');
const pontosEl = document.getElementById('pontos');
const vidasEl = document.getElementById('vidas');

// ===== Estado do jogo (valores que mudam durante a partida) =====
let pontos = 0;
let vidas = 3;
let naveX = cenario.clientWidth / 2; // posição horizontal do centro da nave
let frotaY = 26;                     // posição vertical da frota de ratos
let novelos = [];                    // lista dos tiros que estão na tela
let podeAtirar = true;
let jogoAtivo = true;
const teclas = { esq: false, dir: false };

// ===== Configurações (mexa aqui para ajustar a dificuldade) =====
const VEL_NAVE = 6;      // pixels por quadro
const VEL_TIRO = 8;
const VEL_FROTA = 0.15;  // quanto maior, mais rápido os ratos descem
const PONTOS_POR_RATO = 10;

// ===== Controles: teclado (PC) =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') teclas.esq = true;
  if (e.key === 'ArrowRight' || e.key === 'd') teclas.dir = true;
  if (e.key === ' ') { e.preventDefault(); atirar(); }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') teclas.esq = false;
  if (e.key === 'ArrowRight' || e.key === 'd') teclas.dir = false;
});

// ===== Controles: toque (celular) =====
function segurar(id, lado) {
  const botao = document.getElementById(id);
  botao.addEventListener('pointerdown', () => { teclas[lado] = true; });
  botao.addEventListener('pointerup', () => { teclas[lado] = false; });
  botao.addEventListener('pointerleave', () => { teclas[lado] = false; });
}
segurar('btn-esq', 'esq');
segurar('btn-dir', 'dir');
document.getElementById('btn-atirar').addEventListener('pointerdown', atirar);

// ===== Atirar =====
function atirar() {
  if (!jogoAtivo || !podeAtirar) return;
  podeAtirar = false;
  setTimeout(() => { podeAtirar = true; }, 300); // espera 0,3 s entre tiros

  const el = document.createElement('div');
  el.className = 'novelo';
  el.style.left = naveX + 'px';
  el.style.bottom = '110px';
  cenario.appendChild(el);
  novelos.push({ el: el, y: 110 });
}

// ===== Colisão: dois retângulos se encostam? =====
function bateu(a, b) {
  const r1 = a.getBoundingClientRect();
  const r2 = b.getBoundingClientRect();
  return r1.left < r2.right && r1.right > r2.left &&
         r1.top < r2.bottom && r1.bottom > r2.top;
}

// ===== Atualizar placar =====
function atualizarPlacar() {
  pontosEl.textContent = pontos;
  vidasEl.textContent = vidas > 0 ? '❤️'.repeat(vidas) : '💔';
}

// ===== Laço principal: roda a cada quadro (cerca de 60x por segundo) =====
function loop() {
  if (!jogoAtivo) return;

  // 1. Mover a nave (sem sair do cenário)
  if (teclas.esq) naveX -= VEL_NAVE;
  if (teclas.dir) naveX += VEL_NAVE;
  naveX = Math.max(32, Math.min(cenario.clientWidth - 32, naveX));
  nave.style.left = naveX + 'px';

  // 2. Descer a frota
  frotaY += VEL_FROTA;
  frota.style.top = frotaY + 'px';

  // 3. Mover os tiros e checar colisão com os ratos vivos
  const vivos = [...document.querySelectorAll('.inimigo:not(.morto)')];
  for (let i = novelos.length - 1; i >= 0; i--) {
    const tiro = novelos[i];
    tiro.y += VEL_TIRO;
    tiro.el.style.bottom = tiro.y + 'px';

    let acertou = false;
    for (const rato of vivos) {
      if (!rato.classList.contains('morto') && bateu(tiro.el, rato)) {
        rato.classList.add('morto');
        pontos += PONTOS_POR_RATO;
        acertou = true;
        break;
      }
    }
    if (acertou || tiro.y > cenario.clientHeight) {
      tiro.el.remove();
      novelos.splice(i, 1);
    }
  }
  atualizarPlacar();

  // 4. Algum rato vivo chegou na nave? Perde uma vida.
  const topoNave = nave.getBoundingClientRect().top;
  const invadiu = vivos.some((r) =>
    !r.classList.contains('morto') && r.getBoundingClientRect().bottom > topoNave);
  if (invadiu) {
    vidas--;
    frotaY = 26; // a frota volta para o topo
    atualizarPlacar();
  }

  // 5. Fim: sem vidas ou todos os ratos derrotados
  // (as telas de vitória e derrota entram na etapa 3)
  const restantes = document.querySelectorAll('.inimigo:not(.morto)').length;
  if (vidas <= 0 || restantes === 0) {
    jogoAtivo = false;
    return;
  }

  requestAnimationFrame(loop);
}

atualizarPlacar();
requestAnimationFrame(loop);
