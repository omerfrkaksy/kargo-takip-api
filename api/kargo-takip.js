export default async function handler(req, res) {
  // CORS ayarlari
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const tracking = req.query.tracking;
  if (!tracking) {
    return res.status(400).json({ found: false, error: "Takip numarasi gerekli" });
  }

  const TOKEN = process.env.SHOPPANEL_TOKEN;
  const API = "https://shsbilisim.com/api/v1";

  try {
    let page = 1;
    
    while (page <= 20) {
      const response = await fetch(
        `${API}/orders?page=${page}&per_page=100`,
        {
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) break;
      const data = await response.json();
      
      if (!data.orders || data.orders.length === 0) break;

      for (const order of data.orders) {
        if (order.tracking_number === tracking) {
          const statusMap = {
            'new': { status: 'processing', label: 'Hazirlaniyor' },
            'processing': { status: 'processing', label: 'Hazirlaniyor' },
            'ready_to_ship': { status: 'shipped', label: 'Kargoya Hazir' },
            'shipped': { status: 'transit', label: 'Yolda' },
            'delivered': { status: 'delivered', label: 'Teslim Edildi' },
            'cancelled': { status: 'processing', label: 'Iptal Edildi' },
            'returned': { status: 'processing', label: 'Iade Edildi' }
          };

          const st = statusMap[order.internal_status] || statusMap['new'];
          const s = order.internal_status;
          const timeline = [];

          timeline.push({
            t: "Siparis Alindi",
            d: "Siparisiniz basariyla alindi",
            tm: order.created_at || "-",
            s: "done", i: "check"
          });

          if (['ready_to_ship','shipped','delivered'].includes(s)) {
            timeline.push({
              t: "Kargoya Verildi",
              d: (order.tracking_company || "Yol Kargo") + " teslim aldi",
              tm: order.shipped_at || "-",
              s: "done", i: "box"
            });
          } else {
            timeline.push({
              t: "Kargoya Verilecek", d: "Hazirlaniyor",
              tm: "-", s: s === "processing" ? "now" : "wait", i: "box"
            });
          }

          if (['shipped','delivered'].includes(s)) {
            timeline.push({
              t: "Yolda", d: "Gonderiniz dagitimda",
              tm: "-", s: s === "shipped" ? "now" : "done", i: "truck"
            });
          } else {
            timeline.push({
              t: "Dagitim", d: "Kargo yola cikacak",
              tm: "-", s: "wait", i: "truck"
            });
          }

          if (s === 'delivered') {
            timeline.push({
              t: "Teslim Edildi", d: "Gonderiniz teslim edildi",
              tm: order.delivered_at || "-", s: "done", i: "home"
            });
          } else {
            timeline.push({
              t: "Teslim Edilecek", d: "Tahmini teslimat",
              tm: "-", s: "wait", i: "home"
            });
          }

          return res.json({
            found: true,
            trackingNumber: order.tracking_number,
            status: st.status,
            statusLabel: st.label,
            carrier: order.tracking_company || "Yol Kargo",
            trackingUrl: order.tracking_url || "",
            origin: "Depo",
            destination: order.shipping_address ? (order.shipping_address.city || "-") : "-",
            estimatedDelivery: "-",
            timeline: timeline
          });
        }
      }

      if (page >= (data.pagination ? data.pagination.total_pages : 1)) break;
      page++;
    }

    return res.json({ found: false });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ found: false, error: "Sunucu hatasi" });
  }
}
