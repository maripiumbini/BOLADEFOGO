export default async function handler(req, res) {
    const { code } = req.body;

    // Aqui a BOLA DE FOGO se conecta com o Asana
    // (A gente vai configurar os segredos na Vercel depois)
    const CLIENT_ID = process.env.ASANA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI;

    try {
        // 1. Pede a chave pro Asana usando o código que veio do site
        const resp = await fetch('https://app.asana.com/-/oauth_token', {
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

        const data = await resp.json();
        
        // Se deu tudo certo, a BOLA DE FOGO explode aqui (Lógica de reagendar)
        // Por enquanto, vamos só avisar que recebemos!
        res.status(200).json({ status: "Fogo carregado!", token: data.access_token ? "OK" : "Erro" });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
