export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Sem autorização" });

    try {
        // Pede explicitamente os workspaces
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me?opt_fields=workspaces', {
            headers: { 'Authorization': authHeader }
        });
        const meData = await meResp.json();
        
        // Proteção contra o formato de dados do Asana
        const workspaces = meData.data?.workspaces || meData.workspaces;

        if (!workspaces) return res.status(404).json({ error: "Workspaces não encontrados" });

        let listaGeral = [];

        for (const ws of workspaces) {
            const usersResp = await fetch(`https://app.asana.com/api/1.0/users?workspace=${ws.gid}&opt_fields=name,photo,email`, {
                headers: { 'Authorization': authHeader }
            });
            const usersData = await usersResp.json();
            
            if (usersData.data) {
                listaGeral = [...listaGeral, ...usersData.data];
            }
        }

        // Remove duplicados (caso a pessoa esteja em dois workspaces)
        const equipeUnica = listaGeral.filter((v, i, a) => a.findIndex(t => t.gid === v.gid) === i);

        return res.status(200).json(equipeUnica);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
