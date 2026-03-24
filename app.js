import {
  db,
  atasCollection,
  participantesCollection,
  anotacoesCollection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot
} from "./firebase.js";

// -------------------- Elementos DOM --------------------
const loadingOverlay = document.getElementById("loading-overlay");
const themeToggle = document.getElementById("theme-toggle");
const tabs = document.querySelectorAll(".tab-btn");
const panes = document.querySelectorAll(".tab-pane");

// Dashboard
const totalAtasEl = document.getElementById("total-atas");
const totalParticipantesEl = document.getElementById("total-participantes");
const topProblemaEl = document.getElementById("top-problema");
const freqParticipantesList = document.getElementById("freq-participantes");

// Atas
const formAta = document.getElementById("form-ata");
const ataIdInput = document.getElementById("ata-id");
const ataNumeroInput = document.getElementById("ata-numero");
const ataDataInput = document.getElementById("ata-data");
const ataHoraInicio = document.getElementById("ata-hora-inicio");
const ataHoraFim = document.getElementById("ata-hora-fim");
const inputParticipante = document.getElementById("input-participante");
const addParticipanteBtn = document.getElementById("add-participante-btn");
const participantesListDiv = document.getElementById("participantes-list");
const inputTopico = document.getElementById("input-topico");
const addTopicoBtn = document.getElementById("add-topico-btn");
const topicosListDiv = document.getElementById("topicos-list");
const ataObs = document.getElementById("ata-obs");
const cancelEditAta = document.getElementById("cancel-edit-ata");
const searchAtas = document.getElementById("search-atas");
const atasListDiv = document.getElementById("atas-list");

// Participantes
const novoParticipanteInput = document.getElementById("novo-participante");
const cadastrarParticipanteBtn = document.getElementById("cadastrar-participante");
const buscaParticipantes = document.getElementById("busca-participantes");
const participantesListaDiv = document.getElementById("participantes-lista");

// Anotações
const formAnotacao = document.getElementById("form-anotacao");
const anotacaoIdInput = document.getElementById("anotacao-id");
const anotacaoTexto = document.getElementById("anotacao-texto");
const anotacaoVinculo = document.getElementById("anotacao-vinculo");
const cancelEditAnotacao = document.getElementById("cancel-edit-anotacao");
const buscaAnotacoes = document.getElementById("busca-anotacoes");
const anotacoesListDiv = document.getElementById("anotacoes-list");

// Relatórios
const relDataInicio = document.getElementById("rel-data-inicio");
const relDataFim = document.getElementById("rel-data-fim");
const relPeriodo = document.getElementById("rel-periodo");
const relParticipante = document.getElementById("rel-participante");
const relPalavra = document.getElementById("rel-palavra");
const gerarRelatorioBtn = document.getElementById("gerar-relatorio");
const exportPdfBtn = document.getElementById("export-pdf");
const exportExcelBtn = document.getElementById("export-excel");
const relatorioResultado = document.getElementById("relatorio-resultado");

// Autocomplete datalists
const participantesSuggestions = document.getElementById("participantes-suggestions");
const participantesSuggestionsRel = document.getElementById("participantes-suggestions-rel");

// -------------------- Estado global --------------------
let atas = [];
let participantes = [];
let anotacoes = [];
let editandoAtaId = null;
let editandoAnotacaoId = null;

// -------------------- Helpers --------------------
function showLoading(show) {
  loadingOverlay.style.display = show ? "flex" : "none";
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Formata data para exibição
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// Gera número automático para ata (ex: ATA-2025-001)
async function gerarNumeroAta() {
  const anoAtual = new Date().getFullYear();
  const q = query(atasCollection, where("ano", "==", anoAtual));
  const snapshot = await getDocs(q);
  const count = snapshot.size;
  const sequencial = String(count + 1).padStart(3, "0");
  return `ATA-${anoAtual}-${sequencial}`;
}

// Atualiza o dashboard
function atualizarDashboard() {
  // Total de atas
  totalAtasEl.innerText = atas.length;

  // Participantes únicos (de todas as atas)
  const participantesUnicos = new Set();
  atas.forEach(ata => {
    if (ata.participantes && Array.isArray(ata.participantes)) {
      ata.participantes.forEach(p => participantesUnicos.add(p));
    }
  });
  totalParticipantesEl.innerText = participantesUnicos.size;

  // Problema mais citado (tópico mais frequente)
  const problemas = {};
  atas.forEach(ata => {
    if (ata.topicos && Array.isArray(ata.topicos)) {
      ata.topicos.forEach(topico => {
        problemas[topico] = (problemas[topico] || 0) + 1;
      });
    }
  });
  const topProblema = Object.entries(problemas).sort((a, b) => b[1] - a[1])[0];
  topProblemaEl.innerText = topProblema ? topProblema[0] : "Nenhum";

  // Participantes mais frequentes (top 10)
  const freq = {};
  atas.forEach(ata => {
    if (ata.participantes && Array.isArray(ata.participantes)) {
      ata.participantes.forEach(p => {
        freq[p] = (freq[p] || 0) + 1;
      });
    }
  });
  const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  if (sortedFreq.length === 0) {
    freqParticipantesList.innerHTML = "<li>Nenhum participante registrado</li>";
    return;
  }

  // Exibir como lista estilizada com badges
  freqParticipantesList.innerHTML = sortedFreq.map(([nome, count], index) => `
    <li class="freq-item">
      <span class="freq-rank">${index + 1}º</span>
      <span class="freq-name">${nome}</span>
      <span class="freq-count">${count} reunião${count !== 1 ? 'ões' : ''}</span>
    </li>
  `).join("");
}

// -------------------- CRUD Atas --------------------
async function carregarAtas() {
  showLoading(true);
  const q = query(atasCollection, orderBy("data", "desc"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    atas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAtasList();
    atualizarDashboard();
    showLoading(false);
  }, (error) => {
    console.error("Erro ao carregar atas:", error);
    showToast("Erro ao carregar atas", "error");
    showLoading(false);
  });
  return unsubscribe;
}

function renderAtasList() {
  const searchTerm = searchAtas.value.toLowerCase();
  const filtered = atas.filter(ata => {
    const numeroMatch = ata.numero?.toLowerCase().includes(searchTerm);
    const participantesMatch = ata.participantes?.some(p => p.toLowerCase().includes(searchTerm));
    const topicosMatch = ata.topicos?.some(t => t.toLowerCase().includes(searchTerm));
    return numeroMatch || participantesMatch || topicosMatch;
  });

  if (filtered.length === 0) {
    atasListDiv.innerHTML = "<p class='text-center'>Nenhuma ata encontrada.</p>";
    return;
  }

  atasListDiv.innerHTML = filtered.map(ata => `
    <div class="ata-item">
      <div class="ata-header">
        <div class="ata-title">${ata.numero}</div>
        <div class="ata-meta">${formatDate(ata.data)} | ${ata.horaInicio} - ${ata.horaFim}</div>
      </div>
      <div class="ata-details">
        <strong>Participantes:</strong> ${ata.participantes?.join(", ") || "Nenhum"}<br>
        <strong>Tópicos:</strong> ${ata.topicos?.join(", ") || "Nenhum"}<br>
        <strong>Observações:</strong> ${ata.observacoes || "—"}
      </div>
      <div class="ata-actions">
        <button class="btn-secondary edit-ata" data-id="${ata.id}"><i class="fas fa-edit"></i> Editar</button>
        <button class="btn-secondary delete-ata" data-id="${ata.id}"><i class="fas fa-trash-alt"></i> Excluir</button>
      </div>
    </div>
  `).join("");

  // Eventos dos botões
  document.querySelectorAll(".edit-ata").forEach(btn => {
    btn.addEventListener("click", () => editarAta(btn.dataset.id));
  });
  document.querySelectorAll(".delete-ata").forEach(btn => {
    btn.addEventListener("click", () => excluirAta(btn.dataset.id));
  });
}

async function salvarAta(e) {
  e.preventDefault();
  const data = ataDataInput.value;
  const horaInicio = ataHoraInicio.value;
  const horaFim = ataHoraFim.value;
  const participantes = Array.from(participantesListDiv.querySelectorAll(".tag span:first-child")).map(span => span.innerText);
  const topicos = Array.from(topicosListDiv.querySelectorAll(".tag span:first-child")).map(span => span.innerText);
  const observacoes = ataObs.value;
  const ano = new Date(data).getFullYear();

  if (!data || !horaInicio || !horaFim) {
    showToast("Preencha data e horários", "error");
    return;
  }

  const ataData = {
    numero: ataNumeroInput.value,
    data,
    horaInicio,
    horaFim,
    participantes,
    topicos,
    observacoes,
    ano,
    updatedAt: new Date()
  };

  try {
    if (editandoAtaId) {
      await updateDoc(doc(db, "atas", editandoAtaId), ataData);
      showToast("Ata atualizada com sucesso!");
    } else {
      // Gerar número automático se não tiver
      if (!ataNumeroInput.value) {
        ataData.numero = await gerarNumeroAta();
      }
      await addDoc(atasCollection, ataData);
      showToast("Ata criada com sucesso!");
    }
    resetFormAta();
  } catch (error) {
    console.error("Erro ao salvar ata:", error);
    showToast("Erro ao salvar ata", "error");
  }
}

function resetFormAta() {
  formAta.reset();
  editandoAtaId = null;
  ataIdInput.value = "";
  ataNumeroInput.value = "";
  participantesListDiv.innerHTML = "";
  topicosListDiv.innerHTML = "";
  cancelEditAta.style.display = "none";
}

function editarAta(id) {
  const ata = atas.find(a => a.id === id);
  if (!ata) return;

  editandoAtaId = id;
  ataNumeroInput.value = ata.numero;
  ataDataInput.value = ata.data;
  ataHoraInicio.value = ata.horaInicio;
  ataHoraFim.value = ata.horaFim;
  ataObs.value = ata.observacoes || "";

  // Preencher participantes
  participantesListDiv.innerHTML = "";
  if (ata.participantes && Array.isArray(ata.participantes)) {
    ata.participantes.forEach(p => {
      addTag(participantesListDiv, p);
    });
  }

  // Preencher tópicos
  topicosListDiv.innerHTML = "";
  if (ata.topicos && Array.isArray(ata.topicos)) {
    ata.topicos.forEach(t => {
      addTag(topicosListDiv, t);
    });
  }

  cancelEditAta.style.display = "inline-flex";
  // Rolar para o topo do formulário
  formAta.scrollIntoView({ behavior: "smooth" });
}

async function excluirAta(id) {
  if (!confirm("Tem certeza que deseja excluir esta ata?")) return;
  try {
    await deleteDoc(doc(db, "atas", id));
    showToast("Ata excluída com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir ata:", error);
    showToast("Erro ao excluir ata", "error");
  }
}

// -------------------- CRUD Participantes --------------------
async function carregarParticipantes() {
  const q = query(participantesCollection, orderBy("nome"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    participantes = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
    renderParticipantesList();
    atualizarDatalists();
    showLoading(false);
  }, (error) => {
    console.error("Erro ao carregar participantes:", error);
    showToast("Erro ao carregar participantes", "error");
    showLoading(false);
  });
  return unsubscribe;
}

function renderParticipantesList() {
  const searchTerm = buscaParticipantes.value.toLowerCase();
  const filtered = participantes.filter(p => p.nome.toLowerCase().includes(searchTerm));
  participantesListaDiv.innerHTML = filtered.map(p => `
    <div class="participant-tag">
      <span>${p.nome}</span>
      <i class="fas fa-trash-alt delete-participante" data-id="${p.id}"></i>
    </div>
  `).join("");

  document.querySelectorAll(".delete-participante").forEach(btn => {
    btn.addEventListener("click", () => excluirParticipante(btn.dataset.id));
  });
}

function atualizarDatalists() {
  const options = participantes.map(p => `<option value="${p.nome}">`).join("");
  participantesSuggestions.innerHTML = options;
  participantesSuggestionsRel.innerHTML = options;
}

async function adicionarParticipante() {
  const nome = novoParticipanteInput.value.trim();
  if (!nome) {
    showToast("Digite um nome", "error");
    return;
  }
  try {
    await addDoc(participantesCollection, { nome });
    novoParticipanteInput.value = "";
    showToast("Participante adicionado!");
  } catch (error) {
    console.error("Erro ao adicionar participante:", error);
    showToast("Erro ao adicionar participante", "error");
  }
}

async function excluirParticipante(id) {
  if (!confirm("Remover participante? Ele será removido das atas existentes.")) return;
  try {
    await deleteDoc(doc(db, "participantes", id));
    showToast("Participante removido");
  } catch (error) {
    console.error("Erro ao excluir participante:", error);
    showToast("Erro ao excluir participante", "error");
  }
}

// -------------------- CRUD Anotações --------------------
async function carregarAnotacoes() {
  const q = query(anotacoesCollection, orderBy("createdAt", "desc"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    anotacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAnotacoesList();
    showLoading(false);
  }, (error) => {
    console.error("Erro ao carregar anotações:", error);
    showToast("Erro ao carregar anotações", "error");
    showLoading(false);
  });
  return unsubscribe;
}

function renderAnotacoesList() {
  const searchTerm = buscaAnotacoes.value.toLowerCase();
  const filtered = anotacoes.filter(n => n.texto.toLowerCase().includes(searchTerm));
  anotacoesListDiv.innerHTML = filtered.map(nota => `
    <div class="note-item">
      <div class="note-header">
        <div><i class="fas fa-sticky-note"></i> ${nota.texto.substring(0, 60)}${nota.texto.length > 60 ? "..." : ""}</div>
        <div class="ata-meta">${nota.ataVinculada ? `Vinculada à ata: ${nota.ataVinculada}` : "Sem vínculo"}</div>
      </div>
      <div class="ata-actions">
        <button class="btn-secondary edit-anotacao" data-id="${nota.id}"><i class="fas fa-edit"></i> Editar</button>
        <button class="btn-secondary delete-anotacao" data-id="${nota.id}"><i class="fas fa-trash-alt"></i> Excluir</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-anotacao").forEach(btn => {
    btn.addEventListener("click", () => editarAnotacao(btn.dataset.id));
  });
  document.querySelectorAll(".delete-anotacao").forEach(btn => {
    btn.addEventListener("click", () => excluirAnotacao(btn.dataset.id));
  });
}

async function salvarAnotacao(e) {
  e.preventDefault();
  const texto = anotacaoTexto.value.trim();
  const ataVinculada = anotacaoVinculo.value.trim() || null;

  if (!texto) {
    showToast("Digite o texto da anotação", "error");
    return;
  }

  const dados = {
    texto,
    ataVinculada,
    updatedAt: new Date()
  };

  try {
    if (editandoAnotacaoId) {
      await updateDoc(doc(db, "anotacoes", editandoAnotacaoId), dados);
      showToast("Anotação atualizada!");
    } else {
      await addDoc(anotacoesCollection, { ...dados, createdAt: new Date() });
      showToast("Anotação salva!");
    }
    resetFormAnotacao();
  } catch (error) {
    console.error("Erro ao salvar anotação:", error);
    showToast("Erro ao salvar anotação", "error");
  }
}

function resetFormAnotacao() {
  formAnotacao.reset();
  editandoAnotacaoId = null;
  anotacaoIdInput.value = "";
  cancelEditAnotacao.style.display = "none";
}

function editarAnotacao(id) {
  const nota = anotacoes.find(n => n.id === id);
  if (!nota) return;

  editandoAnotacaoId = id;
  anotacaoTexto.value = nota.texto;
  anotacaoVinculo.value = nota.ataVinculada || "";
  cancelEditAnotacao.style.display = "inline-flex";
  formAnotacao.scrollIntoView({ behavior: "smooth" });
}

async function excluirAnotacao(id) {
  if (!confirm("Excluir esta anotação?")) return;
  try {
    await deleteDoc(doc(db, "anotacoes", id));
    showToast("Anotação excluída");
  } catch (error) {
    console.error("Erro ao excluir anotação:", error);
    showToast("Erro ao excluir anotação", "error");
  }
}

// -------------------- Relatórios --------------------
function filtrarAtas() {
  let resultado = [...atas];
  const dataInicio = relDataInicio.value;
  const dataFim = relDataFim.value;
  const periodo = relPeriodo.value;
  const participante = relParticipante.value.trim().toLowerCase();
  const palavra = relPalavra.value.trim().toLowerCase();

  if (dataInicio) {
    resultado = resultado.filter(ata => ata.data >= dataInicio);
  }
  if (dataFim) {
    resultado = resultado.filter(ata => ata.data <= dataFim);
  }
  if (periodo) {
    resultado = resultado.filter(ata => {
      const hora = parseInt(ata.horaInicio.split(":")[0]);
      if (periodo === "manha") return hora >= 6 && hora < 12;
      if (periodo === "tarde") return hora >= 12 && hora < 18;
      if (periodo === "noite") return hora >= 18;
      return true;
    });
  }
  if (participante) {
    resultado = resultado.filter(ata => ata.participantes?.some(p => p.toLowerCase().includes(participante)));
  }
  if (palavra) {
    resultado = resultado.filter(ata =>
      (ata.topicos?.some(t => t.toLowerCase().includes(palavra))) ||
      (ata.observacoes?.toLowerCase().includes(palavra))
    );
  }

  return resultado;
}

function gerarRelatorio() {
  const filtradas = filtrarAtas();
  if (filtradas.length === 0) {
    relatorioResultado.innerHTML = "<p class='text-center'>Nenhuma ata encontrada com os filtros aplicados.</p>";
    return;
  }

  let html = `<h3>Relatório de Atas</h3><p>${filtradas.length} atas encontradas</p>`;
  filtradas.forEach(ata => {
    html += `
      <div class="relatorio-item">
        <strong>${ata.numero}</strong> - ${formatDate(ata.data)} | ${ata.horaInicio} às ${ata.horaFim}<br>
        <strong>Participantes:</strong> ${ata.participantes?.join(", ") || "Nenhum"}<br>
        <strong>Tópicos:</strong> ${ata.topicos?.join(", ") || "Nenhum"}<br>
        <strong>Observações:</strong> ${ata.observacoes || "—"}
      </div>
    `;
  });
  relatorioResultado.innerHTML = html;
  return filtradas;
}

async function exportarPDF() {
  const filtradas = filtrarAtas();
  if (filtradas.length === 0) {
    showToast("Nenhum dado para exportar", "error");
    return;
  }

  // Criar elemento temporário para renderizar o relatório
  const element = document.createElement("div");
  element.style.padding = "20px";
  element.style.fontFamily = "Inter, sans-serif";
  element.innerHTML = `
    <h1 style="color: #3b82f6;">Porter - Relatório de Atas</h1>
    <p>Gerado em: ${new Date().toLocaleString()}</p>
    ${filtradas.map(ata => `
      <div style="border-bottom: 1px solid #ccc; padding: 10px 0;">
        <strong>${ata.numero}</strong> - ${formatDate(ata.data)} | ${ata.horaInicio} - ${ata.horaFim}<br>
        <strong>Participantes:</strong> ${ata.participantes?.join(", ") || "Nenhum"}<br>
        <strong>Tópicos:</strong> ${ata.topicos?.join(", ") || "Nenhum"}<br>
        <strong>Observações:</strong> ${ata.observacoes || "—"}
      </div>
    `).join("")}
  `;

  document.body.appendChild(element);
  try {
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 190;
    const pageHeight = 277;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let position = 0;
    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    if (imgHeight > pageHeight) {
      // Se necessário, adicionar múltiplas páginas (simplificado)
    }
    pdf.save("relatorio_atas.pdf");
    showToast("PDF gerado com sucesso!");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    showToast("Erro ao gerar PDF", "error");
  } finally {
    element.remove();
  }
}

function exportarExcel() {
  const filtradas = filtrarAtas();
  if (filtradas.length === 0) {
    showToast("Nenhum dado para exportar", "error");
    return;
  }

  const wsData = [
    ["Número", "Data", "Horário", "Participantes", "Tópicos", "Observações"]
  ];
  filtradas.forEach(ata => {
    wsData.push([
      ata.numero,
      ata.data,
      `${ata.horaInicio} - ${ata.horaFim}`,
      ata.participantes?.join("; ") || "",
      ata.topicos?.join("; ") || "",
      ata.observacoes || ""
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Atas");
  XLSX.writeFile(wb, "relatorio_atas.xlsx");
  showToast("Excel exportado!");
}

// -------------------- Tags dinâmicas (participantes/tópicos) --------------------
function addTag(container, text) {
  const tag = document.createElement("div");
  tag.className = "tag";
  tag.innerHTML = `<span>${text}</span><i class="fas fa-times remove-tag"></i>`;
  container.appendChild(tag);
  tag.querySelector(".remove-tag").addEventListener("click", () => tag.remove());
}

function addParticipanteFromInput() {
  const nome = inputParticipante.value.trim();
  if (nome) {
    // Verificar se o nome existe na lista de participantes cadastrados (para consistência)
    const exists = participantes.some(p => p.nome === nome);
    if (!exists) {
      showToast("Participante não cadastrado. Cadastre-o primeiro.", "error");
      return;
    }
    addTag(participantesListDiv, nome);
    inputParticipante.value = "";
  } else {
    showToast("Digite um nome", "error");
  }
}

function addTopicoFromInput() {
  const topico = inputTopico.value.trim();
  if (topico) {
    addTag(topicosListDiv, topico);
    inputTopico.value = "";
  } else {
    showToast("Digite um tópico", "error");
  }
}

// Eventos de tecla (Enter)
inputParticipante.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addParticipanteFromInput();
  }
});
inputTopico.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTopicoFromInput();
  }
});

// -------------------- Inicialização dos participantes no Firestore --------------------
const PREDEFINED_PARTICIPANTS = [
  "CARLINHOS",
  "MIKAEL",
  "MARIO ALEXANDRE CLEMENTIN",
  "VANIA DO SOCORRO LEOCADIO",
  "JACKELINE ARAUJO SAMPAIO DIAS",
  "LUCAS VINICIUS DA SILVA",
  "CARLOS HENRIQUE FERREIRA LEITE",
  "LUIZ FERNANDO S MORYAMA DOS SANTOS",
  "ERICK DE SOUZA RODRIGUES",
  "DEISY SANTOS CRUZ",
  "DANIELE DA SILVA ROCHA",
  "ANA BEATRIZ PEREIRA",
  "VANESSA LOPES SOUZA DE OLIVEIRA",
  "MARIA LUIZA ALEIXO ANTUNES",
  "MARISA MENEGHETTI",
  "LUDMILA R CASSIANO",
  "MARIA GABRIELA ANTONIO",
  "DENISE CRISTINA DE SOUSA",
  "EDSON SILVA MACÊDO",
  "ANA GABRIELLY CORREA FERREIRA",
  "MARIA CLARA RAMOS - CS",
  "GABRIELY AMORIM CAMPOS",
  "THAIS BENA LIMA",
  "ABNER CAVALCANTE"
];

async function inicializarParticipantes() {
  try {
    const snapshot = await getDocs(participantesCollection);
    if (snapshot.empty) {
      showLoading(true);
      for (const nome of PREDEFINED_PARTICIPANTS) {
        await addDoc(participantesCollection, { nome });
      }
      showToast("Lista de participantes carregada com sucesso!");
      showLoading(false);
    }
  } catch (error) {
    console.error("Erro ao inicializar participantes:", error);
    showToast("Erro ao carregar lista inicial de participantes", "error");
  }
}

// -------------------- Tema claro/escuro --------------------
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    document.body.classList.remove("dark");
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
}

function toggleTheme() {
  if (document.body.classList.contains("dark")) {
    document.body.classList.remove("dark");
    localStorage.setItem("theme", "light");
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  } else {
    document.body.classList.add("dark");
    localStorage.setItem("theme", "dark");
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// -------------------- Navegação entre abas --------------------
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      panes.forEach(pane => pane.classList.remove("active"));
      document.getElementById(targetId).classList.add("active");
    });
  });
}

// -------------------- Inicialização --------------------
function init() {
  setupTabs();
  initTheme();
  themeToggle.addEventListener("click", toggleTheme);
  formAta.addEventListener("submit", salvarAta);
  cancelEditAta.addEventListener("click", resetFormAta);
  addParticipanteBtn.addEventListener("click", addParticipanteFromInput);
  addTopicoBtn.addEventListener("click", addTopicoFromInput);
  cadastrarParticipanteBtn.addEventListener("click", adicionarParticipante);
  formAnotacao.addEventListener("submit", salvarAnotacao);
  cancelEditAnotacao.addEventListener("click", resetFormAnotacao);
  gerarRelatorioBtn.addEventListener("click", gerarRelatorio);
  exportPdfBtn.addEventListener("click", exportarPDF);
  exportExcelBtn.addEventListener("click", exportarExcel);
  searchAtas.addEventListener("input", renderAtasList);
  buscaParticipantes.addEventListener("input", renderParticipantesList);
  buscaAnotacoes.addEventListener("input", renderAnotacoesList);

  // Carregar dados
  showLoading(true);
  // Inicializar participantes primeiro (para garantir que existam antes de carregar atas)
  inicializarParticipantes().then(() => {
    carregarParticipantes();
    carregarAtas();
    carregarAnotacoes();
  }).catch(err => {
    console.error("Erro na inicialização:", err);
    carregarParticipantes();
    carregarAtas();
    carregarAnotacoes();
  });
}

init();
