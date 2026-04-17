export default async function handler(req, res) {
    // 1. Configuração de Headers para evitar erros de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    // 2. TRATAMENTO DO ERRO 400: Garante que o body seja lido
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return res.status(400).json({ error: 'JSON Inválido', details: e.message });
        }
    }

    const { token, code } = body;

    // --- LOGICA DE TROCA DE CODE POR TOKEN ---
    if (code) {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('client_id', '1213884306145874');
            params.append('client_secret', '5686000030118835f8d97607a305943b');
            params.append('redirect_uri', req.headers.origin + '/');
            params.append('code', code);

            const tokenResp = await fetch('https://app.asana.com/-/oauth_token', {
                method: 'POST',
                body: params
            });
            const tokenData = await tokenResp.json();
            
            if (tokenData.access_token) {
                return res.status(200).json({ token: tokenData.access_token });
            } else {
                return res.status(400).json({ error: 'Asana negou o code', details: tokenData });
            }
        } catch (e) {
            return res.status(500).json({ error: 'Erro na autenticação' });
        }
    }

    // --- LOGICA DA BOLA DE FOGO ---
    if (!token) {
        return res.status(400).json({ error: 'Token não encontrado no body' });
    }

    try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        
        // Valida usuário
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me?opt_fields=workspaces', { headers });
        const meData = await meResp.json();
        const workspaces = meData.data?.workspaces || meData.workspaces;

        if (!workspaces) return res.status(401).json({ error: 'Token expirado' });

        // Lógica de Data
        let d = new Date();
        let pular = (d.getDay() === 5) ? 3 : (d.getDay() === 6 ? 2 : 1);
        d.setDate(d.getDate() + pular);
        const novaData = d.toISOString().split('T')[0];
        const hoje = new Date().toISOString().split('T')[0];

        let total = 0;
        for (const ws of workspaces) {
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, { headers });
            const tasksJson = await tasksResp.json();
            const tarefas = tasksJson.data || [];

            const updates = tarefas
                .filter(t => !t.completed && t.due_on === hoje)
                .map(t => fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ data: { due_on: novaData } })
                }).then(r => { if(r.ok) total++; }));
            
            await Promise.all(updates);
        }

        return res.status(200).json({ success: true, reagendadas: total });

    } catch (error) {
        return res.status(500).json({ error: 'Erro interno', message: error.message });
    }
}
