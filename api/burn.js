export default async function handler(req, res) {
    const CLIENT_ID = process.env.ASANA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI;

    if (req.method === 'POST') {
        const { code } = req.body;

        try {
            // 1. PEGA O TOKEN
            const tokenResponse = await fetch('https://app.asana.com/-/oauth_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    code: code
                })
            });

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;
            if (!accessToken) return res.status(401).json({ error: "Erro no Token" });

            // 2. DESCOBRE O WORKSPACE E O SEU ID DE USUÁRIO
            const userResp = await fetch('https://app.asana.com/api/1.0/users/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userData = await userResp.json();
            const workspaceGid = userData.data.workspaces[0].gid;
            const myGid = userData.data.gid;

            // 3. DEFINE AMANHÃ
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const amanhaFormatado = amanha.toISOString().split('T')[0];

            // 4. A BUSCA SNIPER: "Tudo o que é meu e não está concluído no workspace inteiro"
            const searchUrl = `https://app.asana.com/api/1.0/workspaces/${workspaceGid}/tasks/search?assignee.any=${myGid}&completed=false&opt_fields=due_on,name`;
            
            const searchResp = await fetch(searchUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            const searchData = await searchResp.json();
            const tasks = searchData.data || [];

            let contador = 0;
            const promessas = [];

            // 5. REAGENDA TUDO
            for (const task of tasks) {
                promessas.push(
                    fetch(`https://app.asana.com/api/1.0/tasks/${task.gid}`, {
                        method: 'PUT',
                        headers: { 
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify({ data: { due_on: amanhaFormatado } })
                    })
                );
                contador++;
            }

            await Promise.all(promessas);

            return res.status(200).json({ success: true, reagendadas: contador });

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    res.status(405).send('Método não permitido');
}
