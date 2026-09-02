// Remplacer la fonction runOCRExtraction dans app.js

function runOCRExtraction(imageDataUrl) {
  state.tempScannedImage = imageDataUrl;
  
  showToast("🧠 Extraction OCR des données en cours...", "info");
  
  // Charger Tesseract depuis CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@v4/dist/tesseract.min.js';
  script.onload = () => {
    const { createWorker } = Tesseract;
    const worker = createWorker();
    
    (async () => {
      try {
        await worker.load();
        await worker.loadLanguage('fra');
        await worker.initialize('fra');
        
        // Convertir dataURL en image pour Tesseract
        const result = await worker.recognize(imageDataUrl);
        const extractedText = result.data.text;
        
        await worker.terminate();
        
        // Parser le texte OCR pour extraire les infos
        const data = parseOCRText(extractedText);
        
        openEditModalWithData({
          id: "BON-" + Date.now().toString().slice(-6),
          nomPrenom: data.nomPrenom,
          date: data.date,
          montant: data.montant,
          devise: "MAD",
          departement: data.departement,
          kilometrage: data.kilometrage,
          immatriculation: data.immatriculation,
          image: imageDataUrl,
          status: "Scanné OCR"
        });
        
        showToast("✅ Extraction réussie !", "success");
      } catch (error) {
        console.error("Erreur OCR:", error);
        showToast("⚠️ Erreur extraction. Remplissez manuellement.", "warning");
        openEditModalWithData({
          id: "BON-" + Date.now().toString().slice(-6),
          image: imageDataUrl
        });
      }
    })();
  };
  document.head.appendChild(script);
}

// Parser le texte OCR pour extraire les données
function parseOCRText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const data = {
    nomPrenom: '',
    date: '',
    montant: 0,
    departement: '',
    kilometrage: 0,
    immatriculation: ''
  };
  
  // Chercher patterns dans le texte
  lines.forEach(line => {
    // Date (format JJ/MM/AAAA ou AAAA-MM-JJ)
    if (/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(line)) {
      const match = line.match(/(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        if (match[1]) data.date = `${match[3]}-${match[2]}-${match[1]}`;
        else data.date = `${match[4]}-${match[5]}-${match[6]}`;
      }
    }
    
    // Montant (nombre avec virgule ou point)
    if (/\d+[,\.]\d{2}|\b\d{2,}\b/.test(line) && parseFloat(line.replace(',', '.')) > 0) {
      const amount = parseFloat(line.replace(',', '.'));
      if (amount < 10000) data.montant = amount; // Limite pour éviter faux positifs
    }
    
    // Kilométrage (contient "km" ou nombre > 10000)
    if (/km|kilomet/i.test(line)) {
      const match = line.match(/(\d+)/);
      if (match) data.kilometrage = parseInt(match[1]);
    }
    
    // Immatriculation (format plaque: XXXX-X-XX)
    if (/\d{4}-[A-Z]-\d{2}|\d{4}[A-Z]\d{2}/.test(line)) {
      data.immatriculation = line.match(/(\d{4}-[A-Z]-\d{2}|\d{4}[A-Z]\d{2})/)[0];
    }
    
    // Département (rechercher dans la liste connue)
    state.departments.forEach(dept => {
      if (line.toLowerCase().includes(dept.toLowerCase())) {
        data.departement = dept;
      }
    });
    
    // Nom (si c'est une ligne courte et pas un nombre)
    if (line.length > 3 && line.length < 50 && !/^\d+/.test(line) && !data.nomPrenom) {
      if (!/montant|date|km|gasoil|bon/i.test(line)) {
        data.nomPrenom = line;
      }
    }
  });
  
  return data;
}
