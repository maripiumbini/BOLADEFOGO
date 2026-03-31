export default async function handler(req, res) {
    const accessToken = req.headers.authorization; // Vamos mandar o token pelo cabeçalho

    try {
        // 1. Pega o seu Workspace
        const userResp = await fetch('https://app.asana.com/api/1.0/users/me', {
            headers: { 'Authorization': accessToken }
        });
        const userData = await userResp.json();
        const workspaceGid = userData.data.workspaces[0].gid;

        // 2. Busca todos os usuários desse Workspace
        const usersResp = await fetch(`https://app.asana.com/api/1.0/users?workspace=${workspaceGid}&opt_fields=name,photo.image_60x60`, {
            headers: { 'Authorization': accessToken }
        });
        const usersData = await usersResp.json();

        return res.status(200).json(usersData.data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
