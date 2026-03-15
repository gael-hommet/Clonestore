fetch("http://localhost:3000/api/pierre/brain", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: "Besoin d’un mail de refus pour un candidat junior, ton humain.",
    tone: "convivial",
    company_name: "CloneStore",
  }),
})
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
