const API_URL = "http://localhost:8000"; // zmień na backend w Render

// Wykres kołowy
fetch(`${API_URL}/assets`)
  .then(res => res.json())
  .then(data => {
    const classes = {};
    data.forEach(a => {
      if(!classes[a.type]) classes[a.type]=0;
      classes[a.type] += a.value;
    });
    new Chart(document.getElementById('myChart').getContext('2d'), {
      type: 'pie',
      data: {
        labels: Object.keys(classes),
        datasets: [{data: Object.values(classes), backgroundColor:['red','blue','green','orange']}]
      },
      options:{responsive:true}
    });
  });

// Wizualizacja grafu
fetch(`${API_URL}/graph`)
  .then(res => res.json())
  .then(data => {
    const nodes = new vis.DataSet(data.nodes.map(n => ({id:n.label, label:n.label, color:n.type=="Equity"?"red":n.type=="Fixed Income"?"blue":n.type=="Commodities"?"green":"orange"})));
    const edges = new vis.DataSet(data.edges.map(e => ({
      from:e.source,
      to:e.target,
      color: e.value>0.6?"green":e.value>0.3?"yellow":"red",
      width: Math.round(e.value*5)
    })));
    new vis.Network(document.getElementById('graph'), {nodes, edges}, {});
  });