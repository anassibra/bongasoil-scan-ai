// Sample Vouchers & Real Ticket Demo Presets
const SAMPLE_DATA = [
  {
    id: "BON-2026-089",
    nomPrenom: "Awass Tahiri",
    date: "2026-08-23",
    montant: 100.00,
    devise: "MAD",
    departement: "Régie (REGIS)",
    kilometrage: 200000,
    immatriculation: "1234-B-26",
    image: "assets/sample_real_ticket.jpg",
    status: "Scanné Auto (Ticket Réel)",
    handwrittenFields: ["nomPrenom", "departement", "kilometrage", "immatriculation"]
  },
  {
    id: "BON-2026-001",
    nomPrenom: "Karim Benali",
    date: "2026-09-02",
    montant: 450.00,
    devise: "DH",
    departement: "Logistique",
    kilometrage: 185200,
    immatriculation: "5678-B-12",
    image: "assets/sample_bon_gasoil_1.jpg",
    status: "Scanné Auto",
    handwrittenFields: ["nomPrenom", "departement", "kilometrage", "immatriculation"]
  },
  {
    id: "BON-2026-002",
    nomPrenom: "Thomas Martin",
    date: "2026-08-28",
    montant: 720.50,
    devise: "DH",
    departement: "Commercial",
    kilometrage: 94350,
    immatriculation: "9123-A-33",
    image: "assets/sample_bon_gasoil_2.jpg",
    status: "Scanné Auto",
    handwrittenFields: ["nomPrenom", "departement", "kilometrage", "immatriculation"]
  }
];

const MOCK_PRESETS = {
  realTicket: {
    nomPrenom: "Awass Tahiri",
    date: "2026-08-23",
    montant: 100.00,
    devise: "MAD",
    departement: "Régie (REGIS)",
    kilometrage: 200000,
    immatriculation: "1234-B-26",
    image: "assets/sample_real_ticket.jpg"
  },
  sample1: {
    nomPrenom: "Karim Benali",
    date: "2026-09-02",
    montant: 450.00,
    devise: "DH",
    departement: "Logistique",
    kilometrage: 185200,
    immatriculation: "5678-B-12",
    image: "assets/sample_bon_gasoil_1.jpg"
  },
  sample2: {
    nomPrenom: "Thomas Martin",
    date: "2026-08-28",
    montant: 720.50,
    devise: "DH",
    departement: "Commercial",
    kilometrage: 94350,
    immatriculation: "9123-A-33",
    image: "assets/sample_bon_gasoil_2.jpg"
  }
};
