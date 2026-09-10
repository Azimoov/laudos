/* Dois controles globais novos: FLAC fisico so com fala + transcricao completa. */
const fs = require('fs');
const path = require('path');
const H = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const falhas = [];
function ok(c, m) { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas.push(m); }

console.log('=== controles visiveis ===');
ok(H.includes('Ouvir áudio (só fala)'), 'há um botão global para o áudio só com fala');
ok(H.includes('Ver transcrição completa'), 'há um botão global para a transcrição');
ok(H.includes('id="rv2Audio" controls'), 'o áudio usa um player normal com controles');
ok(!H.includes('selo+=\'<button class="audio"'),
   'não há botão de áudio por bloco/órgão nos retângulos');

console.log('\n=== sem a mecânica quebradiça de saltos ===');
const novo = H.slice(H.indexOf('/* ============ AUDIO CLINICO NOVO'));
const ateEdicao = novo.slice(0, novo.indexOf('/* edição:'));
ok(ateEdicao.includes('/audio/material/'), 'o player busca o arquivo físico pelo material_id');
ok(!ateEdicao.includes('.currentTime='), 'o mecanismo novo não salta por timestamps');
ok(!ateEdicao.includes('rev2ClipesDoBloco'), 'o mecanismo novo não recorta áudio por órgão');
ok((H.match(/function rev2OuvirAudio\(\)/g) || []).length === 1,
   'há uma única implementação do botão global');
ok(!H.includes('function rev2TocarAudioBloco') && !H.includes('function rev2Tocar('),
   'os dois tocadores antigos foram removidos do código');

console.log('\n=== persistência e vínculo ===');
ok(H.includes('material_ids:') && H.includes('dicom_study_uid:'),
   'payload do banco leva materiais e StudyInstanceUID verdadeiro');
ok(H.includes('dicomStudyUid:est.studyInstanceUid') &&
   H.includes('_dicomStudyUid:est.studyInstanceUid'),
   'StudyInstanceUID verdadeiro acompanha o mesmo exame até o fechamento');
ok(H.includes('materialId:a.materialId||null'), 'sessão preserva material_id');
ok(H.includes('ex._entradaIa = fitaNum || trans'),
   'texto clínico e entrada interna da IA ficam separados');
ok(H.includes("document.getElementById('rv2TranscricaoTexto').textContent=texto"),
   'transcrição entra no modal como texto, sem interpretar HTML');

console.log();
console.log(falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
