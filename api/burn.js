export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    let body = {};
    try {
        body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return res.status(400).json({ error: 'Erro ao processar dados.' });
    }

    const { token, code } = body;

    // LOGIN (Mantendo seu Secret atualizado)
    if (code) {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('client_id', '1213884306145874');
            params.append('client_secret', 'b0fd2eccfce817b3bf8389b3cda05cca'); 
            params.append('redirect_uri', req.headers.origin + '/');
            params.append('code', code);

            const tokenResp = await fetch('https://app.asana.com/-/oauth_token', { method: 'POST', body: params });
            const tokenData = await tokenResp.json();
            if (tokenData.access_token) return res.status(200).json({ token: tokenData.access_token });
            return res.status(400).json({ error: 'Erro no login', details: tokenData });
        } catch (e) { return res.status(500).json({ error: 'Erro na autenticação' }); }
    }

    if (!token) return res.status(400).json({ error: 'Sem token.' });

    try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me?opt_fields=workspaces', { headers });
        const meData = await meResp.json();
        const workspaces = meData.data?.workspaces || meData.workspaces;

        let d = new Date();
        let pular = (d.getDay() === 5) ? 3 : (d.getDay() === 6 ? 2 : 1);
        d.setDate(d.getDate() + pular);
        const novaData = d.toISOString().split('T')[0];
        const hoje = new Date().toISOString().split('T')[0];
        
        let totalReal = 0;

        for (const ws of workspaces) {
            let offset = null;
            let temMais = true;

            // --- INÍCIO DO LOOP DE PAGINAÇÃO ---
            while (temMais) {
                // Buscamos TUDO atribuído a você no Workspace
                let url = `https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${ws.gid}&completed_since=now&limit=100&opt_fields=due_on,completed`;
                if (offset) url += `&offset=${offset}`;

                const tasksResp = await fetch(url, { headers });
                const tasksJson = await tasksResp.json();
                
                const tarefas = tasksJson.data || [];
                
                // Filtra e atualiza as que são para HOJE
                const tarefasParaMudar = tarefas.filter(t => !t.completed && t.due_on === hoje);
                
                const updates = tarefasParaMudar.map(t => 
                    fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({ data: { due_on: novaData } })
                    }).then(r => { if(r.ok) totalReal++; })
                );

                await Promise.all(updates);

                // Verifica se o Asana tem mais tarefas (Paginação)
                if (tasksJson.next_page) {
                    offset = tasksJson.next_page.offset;
                } else {
                    temMais = false;
                }
            }
        }

        return res.status(200).json({ success: true, reagendadas: totalReal });

    } catch (error) {
        return res.status(500).json({ error: 'Erro interno', message: error.message });
    }
}
