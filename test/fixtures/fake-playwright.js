// "playwright" falso para os testes: imprime um resumo no formato do reporter list e sai com o
// código de FAKE_PW_EXIT (padrão 1 = falhou). Instalado em node_modules/.bin da pasta semeada.
const fail = process.env.FAKE_PW_EXIT !== '0';
console.log('Running 3 tests using 1 worker');
if (fail) {
  console.log('  1) [chromium] › login.spec.ts:5:1 › login com senha errada mostra o aviso');
  console.log('');
  console.log('  1 failed');
  console.log('    [chromium] › login.spec.ts:5:1 › login com senha errada mostra o aviso');
  console.log('  2 passed (3.1s)');
} else {
  console.log('  3 passed (2.4s)');
}
process.exit(fail ? 1 : 0);
