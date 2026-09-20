const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');
const { requireAuth } = require('./auth-middleware');
const authRoutes = require('./routes-auth');
const projectRoutes = require('./routes-projects');
const userRoutes = require('./routes-users');

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'changez-moi-en-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' }
}));

app.use('/api', authRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/users', requireAuth, userRoutes);


app.post('/api/extract', requireAuth, async (req, res) => {
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
      '  "immatriculation": "immatriculation marocaine ecrite au stylo. FORMAT STRICT: [chiffres][UNE SEULE lettre][chiffres], SANS tiret, exemple 19714B2. ATTENTION PARTICULIERE: le chiffre manuscrit 7 est TRES SOUVENT confondu avec la lettre F a cause de la barre horizontale du 7 cursif - si tu vois un caractere qui pourrait etre un 7 barre OU un F, et qu il y a deja une autre lettre plus loin dans le numero, alors ce caractere est presque certainement un 7 (chiffre), PAS un F, car une immatriculation marocaine ne contient QU UNE SEULE lettre au total. Compte le nombre de lettres que tu identifies: si tu en vois 2 ou plus, la premiere est tres probablement un chiffre 7 mal interprete. Retranscris chiffre par chiffre exactement ce qui est ecrit."\n' +
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

app.post('/api/extract-batch', requireAuth, async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 manquant' });
    if (!API_KEY) return res.status(500).json({ error: 'Cle API non configuree sur le serveur' });

    const prompt = "Cette image montre une feuille (A4 ou autre) sur laquelle PLUSIEURS bons/tickets de gasoil marocains distincts sont colles ou poses cote a cote. Certaines infos sont imprimees, d'autres ecrites au stylo a la main.\n" +
      "Identifie CHAQUE bon separement et extrais ses champs. Reponds UNIQUEMENT avec un tableau JSON valide, rien d'autre, pas de markdown :\n" +
      "[\n" +
      "  {\n" +
      '    "nomPrenom": "nom et prenom ecrit au stylo",\n' +
      '    "date": "date au format AAAA-MM-JJ (date IMPRIMEE)",\n' +
      '    "montant": nombre decimal du montant total paye,\n' +
      '    "departement": "mot ecrit au stylo identifiant un departement/projet/chantier, vide si absent",\n' +
      '    "kilometrage": nombre entier du kilometrage ecrit au stylo,\n' +
      '    "immatriculation": "immatriculation marocaine ecrite au stylo, FORMAT STRICT [chiffres][UNE SEULE lettre][chiffres] SANS tiret. ATTENTION: le chiffre 7 manuscrit est souvent confondu avec la lettre F. Une immatriculation marocaine ne contient QU UNE SEULE lettre - si tu identifies 2 lettres ou plus, la premiere est probablement un 7 mal lu."\n' +
      "  }\n" +
      "]\n" +
      "Un objet par bon detecte sur la feuille. Si un champ est illisible, mets une chaine vide (ou 0). Ne mets AUCUN texte avant ou apres le tableau JSON.";

    const payload = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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
          res.json(Array.isArray(extracted) ? extracted : []);
        } catch (e) {
          console.error('Erreur parsing batch:', e, data);
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
    console.error('Erreur serveur batch:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/extract-toll', requireAuth, async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 manquant' });
    if (!API_KEY) return res.status(500).json({ error: 'Cle API non configuree sur le serveur' });

    const prompt = "Tu regardes la photo d'un ticket de peage autoroute marocain (ADM). Ce sont des infos IMPRIMEES.\n" +
      "Extrais ces champs et reponds UNIQUEMENT avec un objet JSON valide, rien d'autre, pas de markdown :\n" +
      "{\n" +
      '  "date": "date au format AAAA-MM-JJ",\n' +
      '  "montant": nombre decimal du montant paye en MAD,\n' +
      '  "trajet": "gare d entree - gare de sortie si visibles, sinon le nom de la gare/station imprimee, sinon chaine vide"\n' +
      "}\n" +
      'Si un champ est illisible ou absent, mets une chaine vide "" (ou 0 pour le montant). Ne mets AUCUN texte avant ou apres le JSON.';

    const payload = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
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
          console.error('Erreur parsing toll:', e, data);
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
    console.error('Erreur serveur toll:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/extract-charge', requireAuth, async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 manquant' });
    if (!API_KEY) return res.status(500).json({ error: 'Cle API non configuree sur le serveur' });

    const prompt = "Tu regardes la photo d'un ticket ou recu de depense professionnelle (repas, parking, fournitures, hotel, etc.). Ce sont des infos IMPRIMEES en general.\n" +
      "Extrais ces champs et reponds UNIQUEMENT avec un objet JSON valide, rien d'autre, pas de markdown :\n" +
      "{\n" +
      '  "date": "date au format AAAA-MM-JJ",\n' +
      '  "montant": nombre decimal du montant total paye en MAD,\n' +
      '  "description": "brève description du type de depense (ex: Repas, Parking, Fournitures bureau, Hotel), deduite du contenu du ticket, sinon chaine vide"\n' +
      "}\n" +
      'Si un champ est illisible ou absent, mets une chaine vide "" (ou 0 pour le montant). Ne mets AUCUN texte avant ou apres le JSON.';

    const payload = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
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
          console.error('Erreur parsing charge:', e, data);
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
    console.error('Erreur serveur charge:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/extract-signed-sheet', requireAuth, async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 manquant' });
    if (!API_KEY) return res.status(500).json({ error: 'Cle API non configuree sur le serveur' });

    const prompt = "Tu regardes la photo d'un tableau imprime intitule Feuille de Remboursement, avec des colonnes Nom et Prenom, Departement, Charge, Montant, Signature.\n" +
      "Pour CHAQUE ligne du tableau, determine si la case Signature contient une signature manuscrite (un trait, une griffe, un paraphe, peu importe la forme) ou si elle est restee VIDE.\n" +
      "Reponds UNIQUEMENT avec un tableau JSON valide, rien d'autre, pas de markdown :\n" +
      "[\n" +
      "  {\n" +
      '    "nom": "nom et prenom exact tel qu ecrit sur la ligne (texte imprime)",\n' +
      '    "signe": true ou false selon si la case Signature de cette ligne contient une marque manuscrite\n' +
      "  }\n" +
      "]\n" +
      "Une entree par ligne du tableau (hors ligne TOTAL). Ne mets AUCUN texte avant ou apres le tableau JSON.";

    const payload = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
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
          res.json(Array.isArray(extracted) ? extracted : []);
        } catch (e) {
          console.error('Erreur parsing signed sheet:', e, data);
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
    console.error('Erreur serveur signed sheet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/extract-toll-batch', requireAuth, async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 manquant' });
    if (!API_KEY) return res.status(500).json({ error: 'Cle API non configuree sur le serveur' });

    const prompt = "Cette image montre une feuille sur laquelle PLUSIEURS tickets de peage autoroute marocains (ADM) sont colles ou poses cote a cote. Ce sont des infos IMPRIMEES.\n" +
      "Identifie CHAQUE ticket separement. Reponds UNIQUEMENT avec un tableau JSON valide, rien d'autre, pas de markdown :\n" +
      "[\n" +
      "  {\n" +
      '    "date": "date au format AAAA-MM-JJ",\n' +
      '    "montant": nombre decimal du montant en MAD,\n' +
      '    "trajet": "gare entree - gare sortie si visibles, sinon vide"\n' +
      "  }\n" +
      "]\n" +
      "Un objet par ticket detecte. Si un champ est illisible, mets une chaine vide (ou 0). Ne mets AUCUN texte avant ou apres le tableau JSON.";

    const payload = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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
          if (parsed.error) return res.status(500).json({ error: parsed.error.message || 'Erreur API' });
          const textBlock = parsed.content?.find(c => c.type === 'text');
          if (!textBlock) return res.status(500).json({ error: 'Reponse IA invalide' });
          const cleanText = textBlock.text.replace(/```json|```/g, '').trim();
          const extracted = JSON.parse(cleanText);
          res.json(Array.isArray(extracted) ? extracted : []);
        } catch (e) {
          console.error('Erreur parsing toll batch:', e, data);
          res.status(500).json({ error: 'Erreur de lecture de la reponse IA' });
        }
      });
    });

    apiReq.on('error', (e) => res.status(500).json({ error: 'Erreur de connexion a l API' }));
    apiReq.write(payload);
    apiReq.end();
  } catch (error) {
    console.error('Erreur serveur toll batch:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/extract-charge-batch', requireAuth, async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 manquant' });
    if (!API_KEY) return res.status(500).json({ error: 'Cle API non configuree sur le serveur' });

    const prompt = "Cette image montre une feuille sur laquelle PLUSIEURS recus/tickets de depenses professionnelles (repas, parking, fournitures, hotel, etc.) sont colles ou poses cote a cote. Ce sont des infos IMPRIMEES en general.\n" +
      "Identifie CHAQUE recu separement. Reponds UNIQUEMENT avec un tableau JSON valide, rien d'autre, pas de markdown :\n" +
      "[\n" +
      "  {\n" +
      '    "date": "date au format AAAA-MM-JJ",\n' +
      '    "montant": nombre decimal du montant total paye en MAD,\n' +
      '    "description": "brève description du type de depense (ex: Repas, Parking, Fournitures bureau, Hotel)"\n' +
      "  }\n" +
      "]\n" +
      "Un objet par recu detecte. Si un champ est illisible, mets une chaine vide (ou 0). Ne mets AUCUN texte avant ou apres le tableau JSON.";

    const payload = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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
          if (parsed.error) return res.status(500).json({ error: parsed.error.message || 'Erreur API' });
          const textBlock = parsed.content?.find(c => c.type === 'text');
          if (!textBlock) return res.status(500).json({ error: 'Reponse IA invalide' });
          const cleanText = textBlock.text.replace(/```json|```/g, '').trim();
          const extracted = JSON.parse(cleanText);
          res.json(Array.isArray(extracted) ? extracted : []);
        } catch (e) {
          console.error('Erreur parsing charge batch:', e, data);
          res.status(500).json({ error: 'Erreur de lecture de la reponse IA' });
        }
      });
    });

    apiReq.on('error', (e) => res.status(500).json({ error: 'Erreur de connexion a l API' }));
    apiReq.write(payload);
    apiReq.end();
  } catch (error) {
    console.error('Erreur serveur charge batch:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Serveur demarre sur le port ' + PORT);
});
