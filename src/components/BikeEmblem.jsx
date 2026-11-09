import React from 'react';

/** Die Chrom-Maschine aus dem App-Icon, mit warmem Instrumentenlicht dahinter. */
export default function BikeEmblem({ size = 200, state }) {
    const cls = ['bike-emblem', state === 'error' ? 'is-error shake' : '', state === 'pulse' ? 'is-pulse' : ''].join(' ');
    return (
        <div className={cls} style={{ width: size, height: Math.round(size * 662 / 640) }} aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}bike-chrome.png`} alt="" width={size} height={Math.round(size * 662 / 640)} draggable="false" />
        </div>
    );
}
