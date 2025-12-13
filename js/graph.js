export async function drawPortfolioGraph(data) {
    const container = document.getElementById('portfolio-graph');
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;

    d3.select("#portfolio-graph").selectAll("*").remove();

    const svg = d3.select("#portfolio-graph")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("overflow", "visible")
        .style("background", "transparent");

    const gMain = svg.append("g");

    const gCircle = gMain.append("g").attr("class", "circle-guide");
    const gLinks = gMain.append("g").attr("class", "links");
    const gEdgeLabels = gMain.append("g").attr("class", "edge-labels");
    const gNodes = gMain.append("g").attr("class", "nodes");
    const gNodeLabels = gMain.append("g").attr("class", "node-labels");

    const nodes = data.nodes;
    const links = data.links;
    const nodeById = new Map(nodes.map(d => [d.id, d]));
    links.forEach(l => {
        l.source = nodeById.get(l.source);
        l.target = nodeById.get(l.target);
    });

    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = 400; // bazowy promień okręgu

    // ustawienie węzłów na okręgu
    const n = nodes.length;
    nodes.forEach((d, i) => {
        const angle = (i / n) * 2 * Math.PI;
        d.baseX = centerX + baseRadius * Math.cos(angle);
        d.baseY = centerY + baseRadius * Math.sin(angle);
        d.x = d.baseX;
        d.y = d.baseY;
        d.fx = null;
        d.fy = null;
        d.onCircle = true;
        d.dragging = false;
    });

    function radialForce(nodes, cx, cy, r, strength = 1.0) {
        return function(alpha) {
            nodes.forEach(n => {
                const dx = n.x - cx;
                const dy = n.y - cy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist === 0) return;
                const diff = dist - r;

                if (n.onCircle && !n.dragging) {
                    n.vx = 0;
                    n.vy = 0;
                } else {
                    n.vx -= (dx / dist) * diff * strength * alpha;
                    n.vy -= (dy / dist) * diff * strength * alpha;
                }
            });
        };
    }

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(150).strength(0.3))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("collide", d3.forceCollide().radius(d => 44).strength(1))
        .force("radial", radialForce(nodes, centerX, centerY, baseRadius, 5))
        .alpha(1)
        .alphaDecay(0.02)
        .velocityDecay(0.2);

    const link = gLinks.selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke-width", d => Math.max(1, Math.abs(d.value) * 4))
        .attr("stroke", d => d.value > 0 ? "#e74c3c" : "#27ae60")
        .attr("stroke-opacity", 0.9)
        .style("cursor", "pointer")
        .on("click", function(event, d) {
            link.attr("stroke", l => l.value > 0 ? "#e74c3c" : "#27ae60")
                .attr("stroke-width", l => Math.max(1, Math.abs(l.value) * 4));
            gEdgeLabels.selectAll("text").style("fill", "#000").style("font-weight", "normal");

            d3.select(this)
                .attr("stroke", "orange")
                .attr("stroke-width", Math.max(1, Math.abs(d.value) * 4) + 3);

            gEdgeLabels.selectAll("text")
                .filter(l => l === d)
                .style("fill", "orange")
                .style("font-weight", "bold");

            event.stopPropagation();
        });

    const edgeLabel = gEdgeLabels.selectAll("text")
        .data(links)
        .enter()
        .append("text")
        .attr("class", "edge-label")
        .text(d => d.value.toFixed(2))
        .style("pointer-events", "none");

    const node = gNodes.selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", 40)
        .attr("fill", "#3498db")
        .attr("stroke", "#166fa6")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        );

    const nodeLabel = gNodeLabels.selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .attr("class", "node-label")
        .text(d => d.id)
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        edgeLabel.attr("x", d => (d.source.x + d.target.x)/2 + 10)
            .attr("y", d => (d.source.y + d.target.y)/2 + 10);

        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);

        nodeLabel.attr("x", d => d.x)
            .attr("y", d => d.y);

        // płynny powrót węzłów na obwód
        nodes.forEach(d => {
            if(d.onCircle && !d.dragging){
                const dx = d.x - centerX;
                const dy = d.y - centerY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const targetX = centerX + (dx / dist) * baseRadius;
                const targetY = centerY + (dy / dist) * baseRadius;
                d.x += (targetX - d.x) * 0.2;
                d.y += (targetY - d.y) * 0.2;
            }
        });

        // kolizja węzłów na obwodzie
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i+1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                if(a.onCircle && b.onCircle){
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const minDist = 40*2*1.1;
                    if(dist < minDist && dist > 0){
                        const offset = (minDist - dist)/2;
                        const ox = dx/dist * offset;
                        const oy = dy/dist * offset;
                        if(!a.dragging){ a.x -= ox; a.y -= oy; }
                        if(!b.dragging){ b.x += ox; b.y += oy; }
                    }
                }
            }
        }
    });

    function dragstarted(event, d) { 
        d.dragging = true;
        if (!event.active) simulation.alphaTarget(0.3).restart(); 
        d.fx = d.x; d.fy = d.y; 
    }
    function dragged(event, d) { 
        d.fx = event.x; d.fy = event.y; 
    }
    function dragended(event, d) { 
        d.dragging = false;
        d.fx = null; d.fy = null; 
        if (!event.active) simulation.alphaTarget(0); 
    }

    let currentTransform = d3.zoomIdentity;

    const zoom = d3.zoom()
        .scaleExtent([0.5, 3])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            gMain.attr("transform", currentTransform);
        })
        .on("end", () => {
            const r = baseRadius;
            const marginFactor = 1.2;

            // przekształcenie punktu środka widoku do układu grafu
            const viewCenterGraphX = (width/2 - currentTransform.x) / currentTransform.k;
            const viewCenterGraphY = (height/2 - currentTransform.y) / currentTransform.k;

            // odległość środka widoku od środka okręgu
            const dx = viewCenterGraphX - centerX;
            const dy = viewCenterGraphY - centerY;
            const distance = Math.sqrt(dx*dx + dy*dy);

            // jeśli odległość większa niż 1.2 * promień → powrót
            if(distance > r * marginFactor){
                const targetX = width/2 - centerX * currentTransform.k;
                const targetY = height/2 - centerY * currentTransform.k;

                d3.transition().duration(500).tween("pan", () => {
                    const ix = d3.interpolate(currentTransform.x, targetX);
                    const iy = d3.interpolate(currentTransform.y, targetY);
                    return t => {
                        currentTransform.x = ix(t);
                        currentTransform.y = iy(t);
                        gMain.attr("transform", currentTransform);
                    };
                });
            }
        });

    svg.call(zoom);

    svg.on("click", () => {
        link.attr("stroke", l => l.value > 0 ? "#e74c3c" : "#27ae60")
            .attr("stroke-width", l => Math.max(1, Math.abs(l.value) * 4));
        edgeLabel.style("fill", "#000").style("font-weight", "normal");
    });
}