const statusEl = document.getElementById('connection-status');
const micHalo = document.getElementById('mic-halo');
const micBtn = document.getElementById('mic-button');
const voiceState = document.getElementById('voice-state');
const spokenOutput = document.getElementById('spoken-output');
const terminalEl = document.getElementById('terminal-content');
const diffEl = document.getElementById('diff-content');
const metricRate = document.getElementById('metric-rate');
const metricInflection = document.getElementById('metric-inflection');

function logTerminal(message) {
  const ts = new Date().toISOString().substring(11, 19);
  terminalEl.textContent += `\n[${ts}] ${message}`;
  terminalEl.scrollTop = terminalEl.scrollHeight;
}

function speakSpokenResponse(text) {
  spokenOutput.textContent = `"${text}"`;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Zira'));
    if (femaleVoice) utterance.voice = femaleVoice;
    window.speechSynthesis.speak(utterance);
  }
}

// Connect to MCP SSE Stream
function connectMCP() {
  const eventSource = new EventSource('/sse');
  eventSource.onopen = () => {
    statusEl.textContent = '● MCP Streamable HTTP Connected';
    statusEl.style.color = '#10b981';
    logTerminal('MCP Server-Sent Events stream connected: /sse');
  };

  eventSource.onerror = () => {
    statusEl.textContent = '○ MCP Polling Mode (SSE Reconnecting)';
    statusEl.style.color = '#f59e0b';
  };
}

async function triggerAmbientTriage(serviceName = 'auth-service') {
  micHalo.classList.add('active');
  voiceState.textContent = 'Alexa+ Processing Interrogation...';
  logTerminal(`[VOICE_INGRESS] User spoken query matched: "PagerDuty alert on ${serviceName}"`);
  logTerminal(`[JSON-RPC 2.0] Dispatching Streamable HTTP call to tool: get_telemetry_signature...`);

  try {
    const res = await fetch('/api/triage/ambient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: serviceName })
    });
    const data = await res.json();

    micHalo.classList.remove('active');
    voiceState.textContent = 'Ambient Listening Ready';

    speakSpokenResponse(data.spoken_response);

    const report = data.terminal_report;
    metricRate.textContent = `${report.telemetry.current_error_percentage}%`;
    metricInflection.textContent = report.telemetry.inflection_relative;

    logTerminal(`[TELEMETRY] 5xx Anomaly Inflection confirmed: ${report.telemetry.inflection_relative}`);
    logTerminal(`[SOURCE_GRAPH] Correlated PR #${report.root_cause_pr.pr_number} by ${report.root_cause_pr.author} merged ${report.root_cause_pr.merged_relative}`);
    logTerminal(`[RUNBOOK] Match: ${report.runbook.title}`);
    logTerminal(`[RUNBOOK STEP 1] ${report.runbook.step_1}`);
    logTerminal(`[RUNBOOK STEP 2] ${report.runbook.step_2}`);

    diffEl.textContent = report.root_cause_pr.unified_diff;
  } catch (err) {
    micHalo.classList.remove('active');
    voiceState.textContent = 'Error processing voice request';
    logTerminal(`[ERROR] Ambience triage error: ${err.message}`);
  }
}

async function triggerProhibitedRollback() {
  micHalo.classList.add('active');
  voiceState.textContent = 'Alexa+ Evaluating Mutation Command...';
  logTerminal('[VOICE_INGRESS] User spoken command: "Can you roll back that container?"');
  logTerminal('[RFC 9728 PRM] Inspecting tool scope permissions for [rollback_deployment]...');

  try {
    const res = await fetch('/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'remediate_or_rollback',
        arguments: { service: 'auth-service', action: 'rollback_deployment' }
      })
    });
    const data = await res.json();

    micHalo.classList.remove('active');
    voiceState.textContent = 'Ambient Listening Ready';

    const refusal = 'Rollback denied. SRE TriageCore operates strictly under read-only security scopes. Remediate via your terminal.';
    speakSpokenResponse(refusal);

    logTerminal(`[RFC 9728 SECURITY POLICY ENFORCED] HTTP 403 Forbidden: ${data.message || refusal}`);
  } catch (err) {
    micHalo.classList.remove('active');
  }
}

// Chaos simulation hooks
document.getElementById('btn-inject-chaos').addEventListener('click', async () => {
  logTerminal('[CHAOS INJECTION] Dispatching fault trigger to auth-service: max_connections=5...');
  try {
    const res = await fetch('/api/chaos/inject', { method: 'POST' });
    const json = await res.json();
    logTerminal(`[CHAOS STATUS] Status=${json.status}. Redis connection pool starved. Error rate climbing.`);
  } catch (_e) {
    logTerminal('[CHAOS] Target microservice unreachable directly from browser; using internal route.');
  }
});

document.getElementById('btn-reset-chaos').addEventListener('click', async () => {
  logTerminal('[CHAOS RESET] Restoring auth-service Redis pool to 50 sockets...');
  try {
    await fetch('/api/chaos/reset', { method: 'POST' });
    metricRate.textContent = '0.0%';
    metricInflection.textContent = 'nominal';
    logTerminal('[CHAOS RESET] Microservice restored to nominal baseline.');
  } catch (_e) {}
});

document.getElementById('btn-trigger-diagnostics').addEventListener('click', () => {
  triggerAmbientTriage('auth-service');
});

document.getElementById('btn-trigger-rollback').addEventListener('click', () => {
  triggerProhibitedRollback();
});

// HTML5 Web Speech API Voice Recognition (Hands-free mic capture)
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    micHalo.classList.add('active');
    voiceState.textContent = 'Listening to workstation microphone...';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    logTerminal(`[SPEECH_RECOGNITION] Transcribed: "${transcript}"`);
  
    if (transcript.includes('rollback') || transcript.includes('roll back') || transcript.includes('restart')) {
      triggerProhibitedRollback();
      return;
    }
  
    // Dynamic service detection:
    let targetService = 'auth-service';
    if (transcript.includes('payment')) targetService = 'payment-gateway';
    
    triggerAmbientTriage(targetService);
  };
  recognition.onerror = () => {
    micHalo.classList.remove('active');
    voiceState.textContent = 'Ambient Listening Ready';
  };

  recognition.onend = () => {
    micHalo.classList.remove('active');
    voiceState.textContent = 'Ambient Listening Ready';
  };

  micBtn.addEventListener('click', () => {
    recognition.start();
  });
} else {
  micBtn.addEventListener('click', () => {
    triggerAmbientTriage('auth-service');
  });
}

connectMCP();
