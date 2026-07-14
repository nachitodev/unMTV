import { useEffect, useState } from "react";

export function useTemperature(): number | null {
    const [temp, setTemp] = useState<number | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const cachedW = localStorage.getItem("mtv_weather");
                if (cachedW) {
                    const data = JSON.parse(cachedW);
                    if (Date.now() - data.time < 900000) {
                        setTemp(data.temp);
                        return;
                    }
                }

                let lat = -34.6037;
                let lon = -58.3816;
                const cachedGeo = localStorage.getItem("mtv_geo");

                if (cachedGeo) {
                    const geo = JSON.parse(cachedGeo);
                    lat = geo.lat;
                    lon = geo.lon;
                } else {
                    try {
                        const geoRes = await fetch("https://ipapi.co/json/");
                        if (geoRes.ok) {
                            const geo = await geoRes.json();
                            if (geo.latitude && geo.longitude) {
                                lat = geo.latitude;
                                lon = geo.longitude;
                                localStorage.setItem("mtv_geo", JSON.stringify({ lat, lon }));
                            }
                        }
                    } catch { /* use default coords */ }
                }

                const weatherRes = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`
                );
                if (weatherRes.ok) {
                    const weather = await weatherRes.json();
                    const t = weather.current.temperature_2m;
                    setTemp(t);
                    localStorage.setItem("mtv_weather", JSON.stringify({ temp: t, time: Date.now() }));
                } else if (cachedW) {
                    setTemp(JSON.parse(cachedW).temp);
                }
            } catch {
                const cachedW = localStorage.getItem("mtv_weather");
                setTemp(cachedW ? JSON.parse(cachedW).temp : null);
            }
        }

        load();
        const id = setInterval(load, 900000);
        return () => clearInterval(id);
    }, []);

    return temp;
}
