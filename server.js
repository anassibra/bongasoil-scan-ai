const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

app.post('/api/extract', async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 manquant' });
    if (!API_KEY) return res.status(500).json({ error: 'Clé API non configurée sur le serveur' });

    const prompt = `Tu regardes la photo d'un bon/ticket de gasoil marocain. Certaines infos sont imprimées, d'autres écrites au stylo à la main.
Extrais ces champs et réponds UNIQUEMENT avec un objet JSON valide, rien d'autre, pas de markdown :
{
  "nomPrenom": "nom et prénom écrit au stylo (souvent en haut du ticket)",
  "date": "date au format AAAA-MM-JJ (cherche une date imprimée type JJ/MM/AAAA)",
  "montant": nombre décimal du montant total payé (cherche MONTANT ou TOTAL),
  "kilometrage": nombre entier du kilométrage écrit au stylo (souvent suivi de 'Km'),
  "immatriculation": "immatriculation écrite au stylo, format marocain type 1234-A-12"
}
Si un champ est illisible ou absent, mets une chaîne vide "" (ou 0 pour les nombres). Ne mets AUCUN texte avant ou après le JSON.`;

    const payload = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
          { type: "text", text: prompt }
        ]
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', (chunk) => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.error('Erreur API Anthropic:', parsed.error);
            return res.status(500).json({ error: parsed.error.message || 'Erreur API' });
          }
          const textBlock = parsed.content?.find(c => c.type === 'text');
          if (!textBlock) return res.status(500).json({ error: 'Réponse IA invalide' });

          const cleanText = textBlock.text.replace(/```json|```/g, '').trim();
          const extracted = JSON.parse(cleanText);
          res.json(extracted);
        } catch (e) {
          console.error('Erreur parsing:', e, data);
          res.status(500).json({ error: 'Erreur de lecture de la réponse IA' });
        }
      });
    });

    apiReq.on('error', (e) => {
      console.error('Erreur requête:', e);
      res.status(500).json({ error: 'Erreur de connexion à l\'API' });
    });

    apiReq.write(payload);
    apiReq.end();

  } catch (error) {
    console.error('Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
