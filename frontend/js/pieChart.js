export async function drawPortfolioPieChart(data) {
    const container = d3.select("#dashboard-pie");
    container.selectAll("*").remove(); // wyczyść poprzedni wykres

    const width = 800;
    const height = 900; 
    const radius = Math.min(width, height - 100) / 2 ;

    container
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center");

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${radius + 20})`);

    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.class))
        .range(d3.schemeCategory10);

    const pie = d3.pie()
        .value(d => d.percent)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius)
        .cornerRadius(8)
        .padAngle(0.02);

    const arcs = svg.selectAll(".arc")
        .data(pie(data))
        .enter()
        .append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.class))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("filter", "drop-shadow(4px 4px 6px rgba(0,0,0,0.3))");

    arcs.append("text")
        .attr("transform", d => {
            const [x, y] = arc.centroid(d);
            const factor = 1.4; // 1 - środek, >1 przesunięcie w kierunku krawędzi
            return `translate(${x * factor}, ${y * factor})`;
        })
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .text(d => `${d.data.percent.toFixed(1)}%`);

    const legend = container.append("div")
        .style("display", "flex")
        .style("flex-wrap", "wrap")
        .style("justify-content", "center")
        .style("margin-top", "20px");

    data.forEach(d => {
        const item = legend.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin", "0 10px 5px 10px");

        item.append("div")
            .style("width", "16px")
            .style("height", "16px")
            .style("background-color", color(d.class))
            .style("margin-right", "6px")
            .style("border-radius", "3px");

        item.append("span")
            .style("font-size", "14px")
            .text(d.class);
    });
}