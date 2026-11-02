/* Presentation only: uses the same 1,000 draws and summary statistics as the comparison table. */
const PortfolioDistribution=(()=>{
 const charts=new Map(),pct=x=>(100*x).toFixed(2)+'%';
 function mount(id,c){
  const host=document.getElementById(id);if(!host)return;
  charts.get(id)?.destroy();charts.delete(id);
  const d=GuidedPortfolio.distribution(c),label=`${Math.round(c.equity*100)}% equity, ${Math.round((1-c.equity)*100)}% bonds; within equity ${Math.round(c.home*100)}% HK and ${Math.round((1-c.home)*100)}% global`;
  host.innerHTML=`<figure class="distribution-figure"><h3>Your portfolio return distribution</h3><p class="muted">${label}. Each simulated year starts with HKD 100M.</p><div class="distribution-key"><span><i style="background:#267a70"></i>Normal-year outcomes</span><span><i style="background:#c3614f"></i>Stress-year outcomes</span><span><i style="border-top:3px dashed #173346;height:0"></i>Average return</span></div><div class="distribution-chart"><canvas role="img" aria-label="Histogram of 1,000 one-year portfolio returns. Average ${pct(d.mean)}; worst 5 percent average ${pct(d.worst5)}. A text summary follows."></canvas></div><figcaption><strong>Read it from left to right:</strong> losses on the left, gains on the right. Taller bars mean more simulated years in that return range. Red bars show stress years. The shaded left tail contains the 50 worst outcomes.</figcaption><div class="distribution-stats"><div>Average return<strong>${pct(d.mean)}</strong></div><div>Worst 5% average<strong>${pct(d.worst5)}</strong></div><div>Years with a loss<strong>${(100*d.lossChance).toFixed(1)}%</strong></div></div><p class="muted">The model draws normal years with probability 85% and stress years with 15%. This sample contains ${d.normalCount} normal and ${d.stressCount} stress years. The tail cutoff is ${pct(d.q5)}; its average loss can be more severe.</p></figure>`;
  if(typeof Chart==='undefined')return;
  const top=Math.ceil(Math.max(...d.bins.map(b=>b.normal+b.stress))/20)*20+20;
  const tail={id:'tail-'+id,beforeDatasetsDraw(chart){const {ctx,chartArea:a,scales:{x}}=chart;const edge=Math.max(a.left,Math.min(a.right,x.getPixelForValue(100*d.q5)));ctx.save();ctx.fillStyle='rgba(195,97,79,.11)';ctx.fillRect(a.left,a.top,edge-a.left,a.bottom-a.top);ctx.strokeStyle='#9d3d32';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(edge,a.top);ctx.lineTo(edge,a.bottom);ctx.stroke();ctx.restore();}};
  const chart=new Chart(host.querySelector('canvas'),{type:'bar',data:{datasets:[
   {label:'Normal years',data:d.bins.map(b=>({x:(b.lo+b.hi)/2,y:b.normal})),backgroundColor:'#267a70',stack:'years',barPercentage:1,categoryPercentage:.94},
   {label:'Stress years',data:d.bins.map(b=>({x:(b.lo+b.hi)/2,y:b.stress})),backgroundColor:'#c3614f',stack:'years',barPercentage:1,categoryPercentage:.94},
   {type:'line',label:'Average return',data:[{x:100*d.mean,y:0},{x:100*d.mean,y:top}],borderColor:'#173346',borderDash:[6,4],borderWidth:2,pointRadius:0,stack:'mean',order:-1}
  ]},plugins:[tail],options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items[0].datasetIndex===2?'Average return':`${(items[0].parsed.x-2.5).toFixed(0)}% to ${(items[0].parsed.x+2.5).toFixed(0)}%`,label:item=>item.datasetIndex===2?pct(d.mean):`${item.dataset.label}: ${item.parsed.y} years`}}},scales:{x:{type:'linear',min:d.min,max:d.max,stacked:true,title:{display:true,text:'One-year return (%)',color:'#173346',font:{size:14}},ticks:{color:'#506574',font:{size:12},maxTicksLimit:6,callback:v=>v+'%'},grid:{color:'#e4e9e8'}},y:{beginAtZero:true,max:top,stacked:true,title:{display:true,text:'Number of simulated years',color:'#173346',font:{size:13}},ticks:{color:'#506574',font:{size:12},maxTicksLimit:5},grid:{color:'#e4e9e8'}}}}});
  charts.set(id,chart);
 }
 return {mount};
})();
