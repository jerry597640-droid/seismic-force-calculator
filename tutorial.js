(() => {
  'use strict';
  const data = window.SEISMIC_TUTORIAL;
  if (!data || document.getElementById('tutorialDialog')) return;
  const base = 'https://jerry597640-droid.github.io/seismic-force-calculator/';
  const filename = 'seismic-tutorial-20261008.mp4';
  const isLocal = location.protocol === 'file:';
  const stamp = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,'0')}`;
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dialog = document.createElement('dialog');
  dialog.id = 'tutorialDialog';
  dialog.setAttribute('aria-labelledby','tutorialTitle');
  dialog.innerHTML = `<div class="tutorial-head"><div><h2 id="tutorialTitle">操作影片｜地震力分析工作台</h2><p>4 分 48 秒 · 中文旁白與字幕 · 11 個章節</p></div><button type="button" id="tutorialClose" aria-label="關閉操作影片">關閉</button></div><div class="tutorial-body"><video id="tutorialVideo" controls playsinline preload="none" aria-label="地震力分析工作台操作教學影片"></video><div class="tutorial-controls"><label>播放速度<select id="tutorialSpeed" aria-label="影片播放速度"><option value="0.75">0.75 倍</option><option value="1" selected>正常</option><option value="1.25">1.25 倍</option><option value="1.5">1.5 倍</option><option value="2">2 倍</option></select></label><a href="${base}media/${filename}" download="${filename}">下載影片 MP4</a><button type="button" id="tutorialChoose">選取本機影片</button><input type="file" accept="video/mp4,video/*" id="tutorialLocalFile" hidden></div><p id="tutorialStatus" class="tutorial-status" role="status" aria-live="polite"></p><p class="tutorial-note">本片使用假設數值：Vs30＝225 m/s、第二類地盤，X／Y 向總橫力各 345.76 tf；與操作手冊 A 例的第一類地盤不同。實際個案請依地勘、結構模型及設備資料輸入。</p><h3>章節｜點選跳到該步驟</h3><nav class="tutorial-chapters" aria-label="操作影片章節">${data.chapters.map((c,i)=>`<button type="button" data-tutorial-chapter="${i}"><span>${stamp(c.start)}</span>${escape(c.title)}</button>`).join('')}</nav><p class="tutorial-note">離線觀看：分別下載離線版 HTML 與 MP4，將兩檔放在同一資料夾，或按「選取本機影片」。本機檔案只在瀏覽器播放，不會上傳。手機可使用影片內建全螢幕控制；橫向觀看較清楚。</p><details class="tutorial-transcript"><summary>閱讀影片文字稿</summary>${data.chapters.map(c=>`<h3>${stamp(c.start)} ${escape(c.title)}</h3><p>${escape(c.text)}</p>`).join('')}</details></div>`;
  document.body.appendChild(dialog);
  const video = document.getElementById('tutorialVideo');
  const status = document.getElementById('tutorialStatus');
  let sourceReady = false, localObjectURL = null, returnFocus = null;
  const chapterButtons = [...dialog.querySelectorAll('[data-tutorial-chapter]')];
  function setStatus(text) { status.textContent = text; }
  function ensureSource() {
    if (sourceReady) return;
    video.poster = isLocal ? '' : base + 'media/seismic-tutorial-poster.jpg';
    video.src = isLocal ? filename : base + 'media/' + filename;
    sourceReady = true;
    if (isLocal) setStatus('請播放同資料夾內的影片；若找不到，按「選取本機影片」。');
  }
  function openTutorial() {
    returnFocus = document.activeElement;
    ensureSource();
    if (!dialog.open) dialog.showModal();
    document.getElementById('tutorialClose').focus();
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-tutorial]')) { e.preventDefault(); openTutorial(); }
  });
  document.getElementById('tutorialClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{ video.pause(); returnFocus?.focus?.(); });
  document.getElementById('tutorialSpeed').addEventListener('change',e=>{ video.playbackRate = Number(e.target.value); });
  video.addEventListener('error',()=>setStatus(isLocal ? '無法讀取同資料夾影片，請按「選取本機影片」選擇下載的 MP4。' : '影片暫時無法載入，請確認網路，或下載 MP4 後選取本機影片。'));
  video.addEventListener('loadedmetadata',()=>{
    setStatus('影片已載入，可播放或點選章節。');
    video.playbackRate=Number(document.getElementById('tutorialSpeed').value);
  });
  video.addEventListener('timeupdate',()=>{
    let active=0;
    data.chapters.forEach((c,i)=>{if(video.currentTime >= c.start) active=i;});
    chapterButtons.forEach((b,i)=>b.setAttribute('aria-current',String(i===active)));
  });
  let pendingSeek = null;
  const seek = seconds => {video.currentTime=Math.min(seconds,Math.max(0,video.duration-.1));video.play().catch(()=>setStatus('已移到章節，請按影片播放鍵開始。'));};
  chapterButtons.forEach((button,i)=>button.addEventListener('click',()=>{
    ensureSource();
    pendingSeek=data.chapters[i].start;
    if(video.readyState>=1){seek(pendingSeek);pendingSeek=null;}else{video.preload='metadata';video.load();setStatus('正在載入影片章節…');}
  }));
  video.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){seek(pendingSeek);pendingSeek=null;}});
  const chooser=document.getElementById('tutorialLocalFile');
  document.getElementById('tutorialChoose').addEventListener('click',()=>chooser.click());
  chooser.addEventListener('change',()=>{
    const file=chooser.files?.[0];if(!file)return;
    if(!file.type.startsWith('video/') && !/\.mp4$/i.test(file.name)){setStatus('請選擇影片檔案（建議 MP4）。');return;}
    video.pause();if(localObjectURL)URL.revokeObjectURL(localObjectURL);
    localObjectURL=URL.createObjectURL(file);video.src=localObjectURL;sourceReady=true;pendingSeek=null;video.load();
    setStatus('已選取本機影片：'+file.name);chooser.value='';
  });
  window.addEventListener('pagehide',()=>{if(localObjectURL)URL.revokeObjectURL(localObjectURL);});
  if(location.hash==='#tutorial')openTutorial();
})();
