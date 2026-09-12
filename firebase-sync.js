"use strict";

// -------------------------------------------------------------
// FIREBASE GERÇEK ZAMANLI VERİTABANI BAĞLANTISI VE AKTİF KULLANICI
// -------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyBsIVkmqfb4C1649xLR_nJ2F30qww2tt7c",
    authDomain: "akorstudyo.firebaseapp.com",
    projectId: "akorstudyo",
    storageBucket: "akorstudyo.firebasestorage.app",
    messagingSenderId: "1052428785346",
    appId: "1:1052428785346:web:739942cf50f0460d568d5b",
    databaseURL: "https://akorstudyo-default-rtdb.europe-west1.firebasedatabase.app"
};

try {
    firebase.initializeApp(firebaseConfig);
    // Kural 2 (Cross-Reference): DAW stüdyosunda render alırken veritabanını 
    // uyutabilmek için database değişkenini global (window) objesine bağlıyoruz.
    window.studioDatabase = firebase.database();
    
    const statsRef = window.studioDatabase.ref('stats_final');
    const activeVisitorsRef = window.studioDatabase.ref('active_visitors');
    const myConnectionRef = activeVisitorsRef.push(); 

    window.studioDatabase.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            myConnectionRef.onDisconnect().remove();
            myConnectionRef.set(true);
        }
    });

    activeVisitorsRef.on('value', (snap) => {
        const activeVisitorsEl = document.getElementById('active-visitors');
        if(activeVisitorsEl) activeVisitorsEl.innerText = Math.max(1, snap.numChildren());
    });

    if (!localStorage.getItem('gitar_visited_final')) {
        statsRef.child('visitors').set(firebase.database.ServerValue.increment(1)).catch(()=>{});
        localStorage.setItem('gitar_visited_final', 'true');
    }
    
    statsRef.on('value', (snapshot) => {
        // ÇAPRAZ REFERANS ÇÖZÜMÜ: Eğer DAW kayıt alıyorsa CPU'yu yormamak için UI güncellemelerini yoksay
        if (typeof window.isStudioRecording !== 'undefined' && window.isStudioRecording) return;
        
        requestAnimationFrame(() => {
            const data = snapshot.val() || {};
            const visitorsEl = document.getElementById('total-visitors');
            const likeCountEl = document.getElementById('like-count');
            const dislikeCountEl = document.getElementById('dislike-count');

            if(visitorsEl) visitorsEl.innerText = data.visitors || 0;
            if(likeCountEl) likeCountEl.innerText = data.likes || 0;
            if(dislikeCountEl) dislikeCountEl.innerText = data.dislikes || 0;
        });
    });

    const btnLike = document.getElementById('btn-like');
    const btnDislike = document.getElementById('btn-dislike');
    let userVote = localStorage.getItem('gitar_vote_final'); 

    function updateSocialButtonsUI() {
        if(btnLike) btnLike.classList.toggle('liked', userVote === 'liked');
        if(btnDislike) btnDislike.classList.toggle('disliked', userVote === 'disliked');
    }
    updateSocialButtonsUI();

    if(btnLike) {
        btnLike.addEventListener('click', () => {
            if (userVote === 'liked') {
                statsRef.child('likes').set(firebase.database.ServerValue.increment(-1));
                userVote = null;
            } else {
                statsRef.child('likes').set(firebase.database.ServerValue.increment(1));
                if (userVote === 'disliked') statsRef.child('dislikes').set(firebase.database.ServerValue.increment(-1));
                userVote = 'liked';
            }
            localStorage.setItem('gitar_vote_final', userVote);
            updateSocialButtonsUI();
        });
    }

    if(btnDislike) {
        btnDislike.addEventListener('click', () => {
            if (userVote === 'disliked') {
                statsRef.child('dislikes').set(firebase.database.ServerValue.increment(-1));
                userVote = null;
            } else {
                statsRef.child('dislikes').set(firebase.database.ServerValue.increment(1));
                if (userVote === 'liked') statsRef.child('likes').set(firebase.database.ServerValue.increment(-1));
                userVote = 'disliked';
            }
            localStorage.setItem('gitar_vote_final', userVote);
            updateSocialButtonsUI();
        });
    }

} catch (e) {
    console.log("Firebase Yüklenemedi.");
}