export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Sem autorização" });

    try {
        // 1. Descobre todos os seus Workspaces/Empresas
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me', {
            headers: { 'Authorization': authHeader }
        });
        const meData = await meResp.json();
        const workspaces = meData.data.workspaces;

        let listaGeral = [];

        // 2. Varre cada empresa atrás da galera
        for (const ws of workspaces) {
            // Pedimos o campo 'photo' de forma completa
            const usersResp = await fetch(`https://app.asana.com/api/1.0/users?workspace=${ws.gid}&opt_fields=name,photo,email`, {
                headers: { 'Authorization': authHeader }
            });
            const usersData = await usersResp.json();
            
            if (usersData.data) {
                listaGeral = [...listaGeral, ...usersData.data];
            }
        }

        // 3. Limpa duplicados e organiza
        const equipeUnica = listaGeral.filter((v, i, a) => a.findIndex(t => t.gid === v.gid) === i);

        return res.status(200).json(equipeUnica);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
