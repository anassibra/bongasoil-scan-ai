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
    if (!API_KEY) return res.status(500).json({ error: 'Cle API non configuree sur le serveur' });

    const prompt = "Tu regardes la photo d'un bon/ticket de gasoil marocain. Certaines infos sont imprimees, d'autres ecrites au stylo a la main (souvent en bleu, ecriture cursive).\n" +
      "Extrais ces champs et reponds UNIQUEMENT avec un objet JSON valide, rien d'autre, pas de markdown :\n" +
      "{\n" +
      '  "nomPrenom": "nom et prenom ecrit au stylo (generalement tout en haut du ticket, 2 lignes)",\n' +
      '  "date": "date au format AAAA-MM-JJ (cherche une date IMPRIMEE type JJ/MM/AAAA, pas manuscrite)",\n' +
      '  "montant": nombre decimal du montant total paye (cherche MONTANT ou TOTAL, valeur imprimee),\n' +
      '  "departement": "mot ecrit au stylo qui identifie un departement, projet ou chantier (souvent une seule ligne courte comme Casting, Logistique, etc., situee entre le nom et le kilometrage). Si absent, laisse vide.",\n' +
      '  "kilometrage": nombre entier du kilometrage ecrit au stylo (souvent suivi de Km),\n' +
      '  "immatriculation": "immatriculation marocaine ecrite au stylo. FORMAT STRICT: [chiffres][UNE SEULE lettre][chiffres], SANS tiret, exemple 19714B2. Ne mets JAMAIS plus d une lettre, ne mets AUCUN tiret, ne confonds pas un chiffre manuscrit (comme 7) avec une lettre (comme F). Retranscris chiffre par chiffre exactement ce qui est ecrit."\n' +
      "}\n" +
      'Si un champ est illisible ou absent, mets une chaine vide "" (ou 0 pour les nombres). Ne mets AUCUN texte avant ou apres le JSON.';

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
          if (!textBlock) return res.status(500).json({ error: 'Reponse IA invalide' });

          const cleanText = textBlock.text.replace(/```json|```/g, '').trim();
          const extracted = JSON.parse(cleanText);
          res.json(extracted);
        } catch (e) {
          console.error('Erreur parsing:', e, data);
          res.status(500).json({ error: 'Erreur de lecture de la reponse IA' });
        }
      });
    });

    apiReq.on('error', (e) => {
      console.error('Erreur requete:', e);
      res.status(500).json({ error: 'Erreur de connexion a l API' });
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
  console.log('Serveur demarre sur le port ' + PORT);
});
