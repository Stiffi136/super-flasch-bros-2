import Phaser from 'phaser';
import { BOTTLES, BottleIndex, generateLevel, Level, Platform } from '../shared/game';
import { advanceRunTime, ceilingSwingVelocity, decideGrab, horizontalVelocity, RELEASE_LOCK_SECONDS, RUN_SPEED, runningSpeed, WALL_JUMP_LOCK_SECONDS, wallJumpVelocity } from '../shared/movement';
import { solveLimb } from '../shared/ik';
import { checkpointSpawn } from '../shared/checkpoint';
import { drawFactoryEnvironment } from './factory';
import { createControlHints, createSpeedometer } from './hud';
import { SnapshotInterpolator } from './interpolation';
import { customModules } from './custom-modules';

type Mode = 'menu' | 'play' | 'won';
export type MultiplayerState = {seq:number;x:number;y:number;vx:number;vy:number;grounded:boolean;wall:number;ceiling:boolean;sliding:boolean;facing:number;lean:number;runPhase:number;deaths:number;finished:boolean};
type MultiplayerOptions = {players:Array<{id:string;name:string;bottle:number}>;selfId:string;onState:(state:MultiplayerState)=>void};
type BottlePose = Pick<MultiplayerState,'x'|'y'|'vx'|'grounded'|'wall'|'ceiling'|'sliding'|'facing'|'lean'|'runPhase'> & {bottle:number;animationTime:number;gripMin:number;gripMax:number};
type RemotePlayer = {id:string;name:string;bottle:number;interpolator:SnapshotInterpolator;label:Phaser.GameObjects.Text};
type Dust = { x:number; y:number; vx:number; age:number; life:number; radius:number };
const W = 960, H = 600, PW = 25, PH = 42, FIXED = 1 / 120;

export class GameScene extends Phaser.Scene {
  private mode: Mode = 'menu'; private level!: Level; private gfx!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Container; private title!: Phaser.GameObjects.Text; private progress!: Phaser.GameObjects.Text; private moduleDebug!: Phaser.GameObjects.Text; private timer!: Phaser.GameObjects.Text;
  private choice: BottleIndex = 0; private seed = Math.floor(Math.random() * 0x7fffffff);
  private activeCheckpoint?: Platform;
  private px=40; private py=456; private vx=0; private vy=0; private grounded=false; private wall=0; private ceiling=false; private sliding=false;
  private gripMin=0; private gripMax=0; private releaseLock=0; private lean=0; private runPhase=0;
  private coyote=0; private jumpBuffer=0; private checkpoint={x:40,y:456}; private deaths=0; private elapsed=0; private facing=1;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>; private lastJump=false; private accumulator=0; private startOnCreate=false;
  private followTarget?: Phaser.GameObjects.Zone;
  private dust:Dust[]=[]; private dustTimer=0; private runTime=0;
  private ceilingGripTime=0; private ceilingEntryVelocity=0;
  private multiplayer?:MultiplayerOptions; private remotePlayers=new Map<string,RemotePlayer>(); private networkClock=0; private stateSeq=0;
  private raceWinner?:{id:string;name:string}; private raceBanner?:Phaser.GameObjects.Text;
  private updateSpeedometer!:(speed:number)=>void;
  constructor(){super('game');}
  init(data?:{bottleIndex?:number;seed?:number;startImmediately?:boolean}):void {
    if(data?.bottleIndex!==undefined && data.bottleIndex>=0 && data.bottleIndex<3) this.choice=data.bottleIndex as BottleIndex;
    if(data?.seed!==undefined) this.seed=data.seed>>>0;
    this.startOnCreate=data?.startImmediately??false;
  }
  create():void {
    // The canvas has twice the logical resolution; scale the world camera, not the physics.
    this.cameras.main.setZoom(2);
    this.gfx=this.add.graphics();
    // Compensate for the 2× world-camera zoom so HUD positions stay in logical screen pixels.
    this.ui=this.add.container(W/2,H/2).setScrollFactor(0).setDepth(20);
    const kb=this.input.keyboard!;
    this.keys={left:kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),right:kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),a:kb.addKey('A'),d:kb.addKey('D'),jump:kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),slide:kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),restart:kb.addKey('R')};
    this.input.keyboard!.on('keydown',(e:KeyboardEvent)=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Shift'].includes(e.key)) e.preventDefault();
      if(this.mode==='menu') { if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')this.select(-1); if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')this.select(1); if(e.key==='Enter'||e.key===' ')this.startGame(); }
      else if(this.mode==='won'&&!this.multiplayer&&(e.key==='Enter'||e.key===' '))this.startGame();
    });
    this.drawMenu(); if(this.startOnCreate)this.startGame();
  }
  public startRun(options:{bottleIndex?:number;seed?:number}={}):void {
    if(options.bottleIndex!==undefined&&options.bottleIndex>=0&&options.bottleIndex<3)this.choice=options.bottleIndex as BottleIndex;
    this.seed=options.seed===undefined?Math.floor(Math.random()*0x7fffffff):options.seed>>>0; this.startGame();
  }
  public configureMultiplayer(options:{players:Array<{id:string;name:string;bottle:number}>;selfId:string;onState:(state:MultiplayerState)=>void}):void {
    this.clearMultiplayer(); this.multiplayer=options; this.networkClock=0;this.raceWinner=undefined;
    for(const player of options.players)if(player.id!==options.selfId)this.addRemotePlayer(player);
    this.ensureRaceBanner();
    if(this.mode==='won')this.publishLocalState(true);
  }
  public updateRemotePlayer(id:string,state:MultiplayerState):void {
    if(!this.multiplayer||id===this.multiplayer.selfId)return;
    let player=this.remotePlayers.get(id);
    if(!player){player=this.addRemotePlayer({id,name:id,bottle:0});}
    player.interpolator.push(state,performance.now());

  }
  public removeRemotePlayer(id:string):void {const player=this.remotePlayers.get(id);if(player){player.label.destroy();this.remotePlayers.delete(id);}}
  public clearMultiplayer():void {for(const player of this.remotePlayers.values())player.label.destroy();this.remotePlayers.clear();this.multiplayer=undefined;this.networkClock=0;this.raceWinner=undefined;this.raceBanner?.destroy();this.raceBanner=undefined;}
  public setRaceWinner(id:string):void {const name=this.multiplayer?.players.find(p=>p.id===id)?.name??(id===this.multiplayer?.selfId?'Du':id);this.raceWinner={id,name};this.updateRaceBanner();}
  private ensureRaceBanner():void {if(!this.multiplayer||this.raceBanner||!this.ui)return;this.raceBanner=this.text(W/2,66,'',14,'#ffd66b').setPadding(10,5,10,5).setBackgroundColor('#172638dd');this.ui.add(this.raceBanner);this.updateRaceBanner();}
  private updateRaceBanner():void {if(!this.raceBanner)return;this.raceBanner.setText(this.raceWinner?`GEWONNEN · ${this.raceWinner.name}`:'RENNEN · Wer zuerst ins Ziel kommt, gewinnt');}
  private addRemotePlayer(info:{id:string;name:string;bottle:number}):RemotePlayer {
    const label=this.add.text(0,0,info.name,{fontFamily:'Arial,sans-serif',fontSize:'11px',color:'#ffffff',stroke:'#10202d',strokeThickness:3,align:'center'}).setOrigin(.5,1).setDepth(10).setVisible(false);
    const player={id:info.id,name:info.name,bottle:Math.max(0,Math.min(BOTTLES.length-1,Math.floor(info.bottle))),interpolator:new SnapshotInterpolator(),label};this.remotePlayers.set(info.id,player);return player;
  }
  private localState(finished=false):MultiplayerState{return {seq:++this.stateSeq,x:this.px,y:this.py,vx:this.vx,vy:this.vy,grounded:this.grounded,wall:this.wall,ceiling:this.ceiling,sliding:this.sliding,facing:this.facing,lean:this.lean,runPhase:this.runPhase,deaths:this.deaths,finished};}
  private publishLocalState(finished=false):void {if(this.multiplayer)this.multiplayer.onState(this.localState(finished));}
  private text(x:number,y:number,s:string,size:number,color='#f5f3ea',originX=0.5):Phaser.GameObjects.Text{return this.add.text(x,y,s,{fontFamily:'Arial,sans-serif',fontSize:`${size}px`,color,align:'center',wordWrap:{width:820},resolution:2}).setOrigin(originX,0.5).setScrollFactor(0);}
  private clearUI():void{this.ui.removeAll(true);this.raceBanner=undefined;}
  private drawMenu():void {
    this.mode='menu';this.clearUI();this.ui.add(this.text(W/2,80,'SUPER FLASCH BROS. 2',38));
    this.ui.add(this.text(W/2,128,'Ein SPS-Bug wurde zur Superkraft.',18,'#9fb8ce'));
    this.ui.add(this.text(W/2,173,'Greif Wände und Decken. Springe, hangle, rutsche bis zum Ziel.',17));
    this.ui.add(this.text(W/2,235,'WÄHLE DEINE FLASCHE',14,'#89a8c5'));
    BOTTLES.forEach((b,i)=>{const x=W/2+(i-1)*160,c=this.add.graphics();c.fillStyle(b.color,1);c.fillRoundedRect(x-25,267,50,82,16);c.fillStyle(b.cap,1);c.fillRoundedRect(x-10,253,20,18,5);c.lineStyle(i===this.choice?3:1,i===this.choice?0xffd66b:0x71869a,1);c.strokeRoundedRect(x-31,247,62,108,13);this.ui.add(c);this.ui.add(this.text(x,374,b.name,17,i===this.choice?'#ffd66b':'#dce6ee'));const hit=this.add.rectangle(x,300,100,126,0xffffff,0).setInteractive();hit.on('pointerdown',()=>{this.choice=i as BottleIndex;this.drawMenu();});this.ui.add(hit);});
    const go=this.text(W/2,438,'▶  STARTEN',24,'#101b2c').setPadding(22,12,22,12).setBackgroundColor('#ffd66b').setInteractive({useHandCursor:true});go.on('pointerdown',()=>this.startGame());this.ui.add(go);
    this.ui.add(this.text(W/2,510,'A/D oder ←/→ bewegen • SPACE springen • SHIFT rutschen / loslassen • R Checkpoint',14,'#b4c4d1'));
    this.ui.add(this.text(W/2,548,'Singleplayer läuft vollständig lokal – kein Spielserver nötig.',13,'#728ba1'));this.cameras.main.setScroll(0,0);this.gfx.clear();
  }
  private select(d:number):void{this.choice=((this.choice+d+3)%3) as BottleIndex;this.drawMenu();}
  private startGame():void {
    this.mode='play';this.level=generateLevel(this.seed,customModules);this.px=this.level.spawn.x;this.py=this.level.spawn.y;this.vx=this.vy=0;this.checkpoint={...this.level.spawn};this.activeCheckpoint=undefined;this.deaths=0;this.elapsed=0;this.accumulator=0;this.grounded=false;this.wall=0;this.ceiling=false;this.sliding=false;this.coyote=0;this.jumpBuffer=0;this.releaseLock=0;this.lean=0;this.runPhase=0;this.lastJump=false;this.clearUI();
    this.dust=[];this.dustTimer=0;this.runTime=0;this.ceilingGripTime=0;this.ceilingEntryVelocity=0;this.gfx.clear();
    this.cameras.main.setBounds(-180,0,this.level.width+250,720);
    if (!this.followTarget || !this.followTarget.active) this.followTarget=this.add.zone(this.px,this.py,1,1);
    this.followTarget.setPosition(this.px+PW/2,this.py+PH/2);
    this.cameras.main.startFollow(this.followTarget,false,.25,.25,-150,0);
    this.cameras.main.centerOn(this.px+PW/2,this.py+PH/2);
    this.title=this.text(18,18,'',14,'#ffffff',0).setOrigin(0,0);this.progress=this.text(W-18,18,'',14,'#ffffff',1).setOrigin(1,0);
    this.moduleDebug=this.text(18,40,'',12,'#f8d39b',0).setOrigin(0,0).setBackgroundColor('#231711cc').setPadding(5,3,5,3);
    const timerPlate=this.add.graphics().setScrollFactor(0);
    timerPlate.fillStyle(0x211713,.94);timerPlate.fillRoundedRect(W/2-59,8,118,37,7);
    timerPlate.lineStyle(1.5,0xb78155,.95);timerPlate.strokeRoundedRect(W/2-59,8,118,37,7);
    timerPlate.fillStyle(0xd7a36f,1);timerPlate.fillCircle(W/2-48,26.5,2);timerPlate.fillCircle(W/2+48,26.5,2);
    this.timer=this.text(W/2,26,'00:00.0',20,'#ffe0a6').setFontFamily('monospace').setFontStyle('bold');
    const speedometer=createSpeedometer(this,W-65,H-65);this.updateSpeedometer=speedometer.update;
    this.ui.add(this.title);this.ui.add(this.progress);this.ui.add(this.moduleDebug);this.ui.add(timerPlate);this.ui.add(this.timer);this.ui.add(createControlHints(this,W/2,H-23));this.ui.add(speedometer.container);this.ensureRaceBanner();
  }
  update(_t:number,delta:number):void {
    if(this.mode==='won'&&this.multiplayer){this.gfx.clear();drawFactoryEnvironment(this.gfx,this.level,this.cameras.main);this.drawRemotePlayers();return;}
    if(this.mode!=='play')return;this.accumulator+=Math.min(delta/1000,.1);let n=0;
    while(this.accumulator>=FIXED&&n<8&&this.mode==='play'){this.simulate(FIXED);this.accumulator-=FIXED;n++;}if(n===8)this.accumulator=0;
    if(this.mode==='play'&&this.multiplayer){this.drawWorld(PH);this.drawRemotePlayers();}
  }
  private simulate(dt:number):void {
    this.elapsed+=dt;const left=this.keys.left.isDown||this.keys.a.isDown,right=this.keys.right.isDown||this.keys.d.isDown,dir=Number(right)-Number(left),jump=this.keys.jump.isDown,drop=this.keys.slide.isDown;
    this.releaseLock=Math.max(0,this.releaseLock-dt);
    const solids=this.level.platforms.filter(p=>p.kind==='solid');
    // Sliding changes the pose and friction, not the bottle's size or hitbox.
    this.sliding=this.keys.slide.isDown&&this.grounded;
    const bh=PH;
    const jumpPressed=jump&&!this.lastJump;
    if(jumpPressed)this.jumpBuffer=.14;else this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.lastJump=jump;
    if(this.grounded)this.coyote=.105;else this.coyote=Math.max(0,this.coyote-dt);
    let contactWall: -1|0|1=0, contactCeiling=false;
    const cx=this.px+PW/2,cy=this.py+bh/2;
    for(const p of solids){
      // Use actual collision contact, not the previous 10 px proximity check.
      if(Math.abs(this.py-(p.y+p.h))<1&&cx>p.x&&cx<p.x+p.w){contactCeiling=true;this.gripMin=p.x;this.gripMax=p.x+p.w;}
      if(cy>p.y+2&&cy<p.y+p.h-2){if(Math.abs(this.px+PW-p.x)<1)contactWall=-1;if(Math.abs(this.px-(p.x+p.w))<1)contactWall=1;}
    }
    const wasCeiling=this.ceiling;
    const decision=decideGrab({wall:contactWall,ceiling:contactCeiling},this.grounded,this.coyote,this.jumpBuffer>0,this.releaseLock,drop);
    // A held ground jump must not immediately trigger a ceiling swing.
    if(decision.jump==='ceiling'&&!jumpPressed){decision.jump=null;decision.ceiling=true;}
    if(!wasCeiling&&(decision.ceiling||decision.jump==='ceiling')){this.ceilingGripTime=0;this.ceilingEntryVelocity=this.vx;}
    this.wall=decision.wall;this.ceiling=decision.ceiling;
    if(decision.jump==='drop'){
      // Only a held ceiling grip launches forward; wall release still drops normally.
      if(wasCeiling&&contactCeiling){this.vx=ceilingSwingVelocity(this.ceilingEntryVelocity,dir,this.facing,this.ceilingGripTime);this.vy=Math.max(this.vy,150);}
      else this.vy=Math.max(this.vy,90);
      this.releaseLock=RELEASE_LOCK_SECONDS;
    }
    else if(decision.jump==='wall'&&contactWall!==0){this.vy=-590;this.vx=wallJumpVelocity(contactWall,this.runTime);this.releaseLock=WALL_JUMP_LOCK_SECONDS;this.jumpBuffer=0;this.grounded=false;this.coyote=0;}
    else if(decision.jump==='ceiling'){this.vx=ceilingSwingVelocity(this.ceilingEntryVelocity,dir,this.facing,this.ceilingGripTime);this.vy=150;this.releaseLock=RELEASE_LOCK_SECONDS;this.jumpBuffer=0;this.grounded=false;this.coyote=0;}
    else if(decision.jump==='ground'){this.vy=-590;this.jumpBuffer=0;this.grounded=false;this.coyote=0;}
    if(this.ceiling){this.ceilingGripTime+=dt;this.vy=0;this.vx=dir*190;}else if(this.wall){this.vx=0;this.vy=Math.max(0,Math.min(this.vy,35));}else{
      this.vx=horizontalVelocity(this.vx,dir,this.grounded,this.sliding,dt,runningSpeed(this.runTime));
      this.vy=Math.min(this.vy+1550*dt,850);if(!jump&&this.vy< -180)this.vy+=1100*dt;
    }
    if(dir)this.facing=dir;const oldX=this.px,oldY=this.py;this.px+=this.vx*dt;
    this.cameras.main.setFollowOffset(-this.facing*150,0);
    let blocked=false;
    for(const p of solids)if(overlap(this.px,this.py,PW,bh,p)){if(this.vx>0&&oldX+PW<=p.x+3)this.px=p.x-PW;else if(this.vx<0&&oldX>=p.x+p.w-3)this.px=p.x+p.w;this.vx=0;blocked=true;}
    this.py+=this.vy*dt;this.grounded=false;
    for(const p of solids)if(overlap(this.px,this.py,PW,bh,p)){if(this.vy>0&&oldY+bh<=p.y+4){this.py=p.y-bh;this.vy=0;this.grounded=true;}else if(this.vy<0&&oldY>=p.y+p.h-4){this.py=p.y+p.h;this.vy=0;}}
    if(this.py>720)this.respawn();
    for(const p of this.level.platforms){
      if(p.kind==='hazard'&&overlap(this.px,this.py,PW,bh,p))this.respawn();
      if(p.kind==='checkpoint'&&p!==this.activeCheckpoint&&overlap(this.px,this.py,PW,bh,p)){
        const spawn=checkpointSpawn(p,solids,PW,bh);
        if(spawn){this.checkpoint=spawn;this.activeCheckpoint=p;}
      }
      // win() destroys the gameplay HUD; stop this tick before it can use it again.
      if(p.kind==='goal'&&overlap(this.px,this.py,PW,bh,p)){this.win();return;}
    }
    if(Phaser.Input.Keyboard.JustDown(this.keys.restart))this.respawn();
    this.runTime=advanceRunTime(this.runTime,this.vx,dir,this.grounded,this.sliding,blocked||!!this.wall||this.ceiling,dt);
    const leanTarget=this.grounded&&!this.wall&&!this.ceiling
      ? this.sliding ? -this.facing*0.9 : Math.max(-1,Math.min(1,this.vx/RUN_SPEED))*0.52
      : 0;
    this.lean+=(leanTarget-this.lean)*(1-Math.exp(-12*dt));
    if(this.grounded&&!this.sliding) this.runPhase+=Math.min(1,Math.abs(this.vx)/RUN_SPEED)*24*dt;
    this.updateDust(dt,bh);
    this.followTarget?.setPosition(this.px+PW/2,this.py+bh/2);
    this.drawWorld(bh);
    if(this.multiplayer){this.networkClock+=dt;if(this.networkClock>=1/18){this.networkClock%=1/18;this.publishLocalState();}}
    this.title.setText(`${BOTTLES[this.choice].name} • KO ${this.deaths}`);this.progress.setText(`SEED ${this.seed.toString(16).toUpperCase()} • ${Math.min(99,Math.floor(this.px/this.level.width*100))}%`);
    const tenths=Math.floor(this.elapsed*10),minutes=Math.floor(tenths/600),seconds=Math.floor(tenths/10)%60;
    this.timer.setText(`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${tenths%10}`);
    this.updateSpeedometer(this.vx);
    const moduleIndex=this.level.modules.findIndex(m=>this.px+PW/2>=m.startX&&this.px+PW/2<m.endX);
    const module=this.level.modules[moduleIndex];
    this.moduleDebug.setText(module?`MODUL ${moduleIndex+1}/${this.level.modules.length} · ${module.name} · x ${Math.floor(this.px-module.startX)}/${module.endX-module.startX}`:'STARTBEREICH');
  }
  private respawn():void{this.dust=[];this.dustTimer=0;this.runTime=0;this.ceilingGripTime=0;this.ceilingEntryVelocity=0;this.deaths++;this.px=this.checkpoint.x;this.py=this.checkpoint.y;this.vx=this.vy=0;this.grounded=false;this.wall=0;this.ceiling=false;this.sliding=false;this.coyote=0;this.jumpBuffer=0;this.releaseLock=0;this.lean=0;}
  private win():void{this.mode='won';if(this.multiplayer)this.publishLocalState(true);this.cameras.main.stopFollow();this.gfx.clear();drawFactoryEnvironment(this.gfx,this.level,this.cameras.main);if(this.multiplayer)this.drawRemotePlayers();this.clearUI();this.ui.add(this.text(W/2,190,'LEVEL GESCHAFFT!',38,'#ffd66b'));this.ui.add(this.text(W/2,260,`Zeit ${this.elapsed.toFixed(1)} s • Neustarts ${this.deaths}`,20));this.ui.add(this.text(W/2,330,`Seed ${this.seed.toString(16).toUpperCase()}`,16,'#9fb8ce'));if(this.multiplayer){this.ensureRaceBanner();this.ui.add(this.text(W/2,390,'Die anderen spielen weiter. Zurück zum Menü über die Shell.',15,'#b4c4d1'));}else{const again=this.text(W/2,420,'NOCH EIN RUN ↻',22,'#101b2c').setPadding(20,12,20,12).setBackgroundColor('#ffd66b').setInteractive();again.on('pointerdown',()=>{this.seed=Math.floor(Math.random()*0x7fffffff);this.startGame();});this.ui.add(again);this.ui.add(this.text(W/2,490,'ENTER oder SPACE zum Neustart',14,'#b4c4d1'));}}
  private updateDust(dt:number,bh:number):void {
    for(const puff of this.dust){puff.age+=dt;puff.x+=puff.vx*dt;puff.y-=10*dt;}
    this.dust=this.dust.filter(puff=>puff.age<puff.life);
    const speed=Math.abs(this.vx);
    if(!this.grounded||this.sliding||this.wall||this.ceiling||speed<180){this.dustTimer=0;return;}
    this.dustTimer-=dt;
    if(this.dustTimer<=0){
      const direction=Math.sign(this.vx);
      this.dust.push({x:this.px+PW/2-direction*12,y:this.py+bh-3,vx:-direction*(25+speed*.08),age:0,life:.34,radius:3.5});
      this.dustTimer=.075;
    }
  }
  private drawWorld(bh:number):void {
    const g=this.gfx;g.clear();const cam=this.cameras.main;
    drawFactoryEnvironment(g,this.level,cam);
    for(const puff of this.dust){
      const t=puff.age/puff.life;
      g.fillStyle(0xc69b73,(1-t)*.48);g.fillCircle(puff.x,puff.y,puff.radius+t*4);
      g.fillStyle(0xe6c5a0,(1-t)*.28);g.fillCircle(puff.x-2,puff.y-2,puff.radius*.6+t*2);
    }
    this.drawBottle(g,bh,{x:this.px,y:this.py,vx:this.vx,grounded:this.grounded,wall:this.wall,ceiling:this.ceiling,sliding:this.sliding,facing:this.facing,lean:this.lean,runPhase:this.runPhase,bottle:this.choice,animationTime:this.runPhase/24,gripMin:this.gripMin,gripMax:this.gripMax});
  }
  private drawRemotePlayers():void {
    if(!this.multiplayer)return;
    const now=performance.now();
    for(const p of this.remotePlayers.values()){
      const state=p.interpolator.sample(now);
      if(!state){p.label.setVisible(false);continue;}
      const mid=state.x+PW/2;
      // Recover the same ceiling contact limits from the shared level geometry.
      const roof=state.ceiling?this.level.platforms.find(q=>q.kind==='solid'&&Math.abs(state.y-(q.y+q.h))<2&&mid>q.x&&mid<q.x+q.w):undefined;
      this.drawBottle(this.gfx,PH,{...state,bottle:p.bottle,animationTime:state.runPhase/24,gripMin:roof?.x??mid-100,gripMax:roof?roof.x+roof.w:mid+100});
      p.label.setVisible(true).setText(p.name+(state.finished?' ✓':''));
      p.label.setPosition(mid,state.y-28);
    }
  }
  private drawBottle(g:Phaser.GameObjects.Graphics,h:number,pose:BottlePose):void {
    // Lift only the artwork: physics and its collision rectangle stay unchanged.
    const x=pose.x,physicsY=pose.y,lift=pose.ceiling?-3:12,y=physicsY-lift,mid=x+PW/2,bottle=BOTTLES[pose.bottle],color=bottle.color;
    const speed=Math.min(1,Math.abs(pose.vx)/RUN_SPEED),phase=pose.runPhase;
    const stride=Math.sin(phase)*speed, airborne=!pose.grounded&&!pose.wall&&!pose.ceiling;
    // Rotate art around the feet; collision and contact targets remain in world coordinates.
    const pivotX=mid,pivotY=y+h,angle=pose.lean,cos=Math.cos(angle),sin=Math.sin(angle);
    const bodyPoint=(px:number,py:number)=>({x:pivotX+(px-pivotX)*cos-(py-pivotY)*sin,y:pivotY+(px-pivotX)*sin+(py-pivotY)*cos});
    const drawPair=(s:number)=>{
      const hip=bodyPoint(mid+s*1.5,y+h-6),shoulder=bodyPoint(mid+s*1.5,y+17);
      let footX=mid+s*5,footY=physicsY+h-1;
      if(pose.sliding){footX=mid+s*10;}
      else if(pose.grounded){const legStride=stride*s;footX=mid+s*2+pose.facing*legStride*14;footY-=Math.max(0,legStride)*9;}
      else if(airborne){footX=hip.x+s*6;footY=hip.y+16+Math.sin(pose.animationTime*6+s)*2;}
      else{footX=hip.x+s*6;footY=hip.y+16;}
      this.drawLimb(g,hip.x,hip.y,footX,footY,11,11,pose.facing);
      const armSwing=stride*s;
      let handX=shoulder.x+pose.facing*(s*3-armSwing*12),handY=shoulder.y+12-Math.max(0,-armSwing)*7;
      if(pose.ceiling){handX=Phaser.Math.Clamp(mid+s*7,pose.gripMin+2,pose.gripMax-2);handY=physicsY;}
      else if(pose.wall){handX=pose.wall<0?x+PW:x;handY=shoulder.y+s*3;}
      this.drawLimb(g,shoulder.x,shoulder.y,handX,handY,12,12,-pose.facing);
    };
    drawPair(-1);
    // Phaser Graphics transforms are queued; leave the IK in world coordinates.
    g.save();g.translateCanvas(pivotX,pivotY);g.rotateCanvas(angle);g.translateCanvas(-pivotX,-pivotY);
    // One continuous silhouette avoids a seam between the centered neck and shoulders.
    const left=x+4,right=x+PW-4,bottom=y+h;
    const outline=()=>{
      g.beginPath();g.moveTo(mid-3.5,y+2);g.lineTo(mid+3.5,y+2);g.lineTo(mid+3.5,y+6);
      g.lineTo(right-2,y+10);g.lineTo(right,y+14);g.lineTo(right,bottom-6);
      g.lineTo(right-2,bottom-2);g.lineTo(right-5,bottom);g.lineTo(left+5,bottom);
      g.lineTo(left+2,bottom-2);g.lineTo(left,bottom-6);g.lineTo(left,y+14);
      g.lineTo(left+2,y+10);g.lineTo(mid-3.5,y+6);g.closePath();
    };
    outline();g.fillStyle(color);g.fillPath();g.lineStyle(1.7,0x183040,.9);g.strokePath();
    g.fillStyle(0xffffff,.22);g.fillRoundedRect(x+6,y+13,3,Math.max(7,h-19),2);
    g.fillStyle(bottle.cap);g.fillRoundedRect(mid-5,y-3,10,6,2);
    g.lineStyle(1,0x183040,.75);g.strokeRoundedRect(mid-5,y-3,10,6,2);
    g.fillStyle(bottle.cap,.85);g.fillRoundedRect(x+7,y+Math.min(27,h-12),PW-14,6,2);
    g.fillStyle(0x173044);g.fillCircle(mid+pose.facing*6,y+17,1.9);
    g.lineStyle(1.3,0x173044);g.beginPath();g.arc(mid+pose.facing*6,y+23,3,.15,2.8,false);g.strokePath();
    g.restore();
    drawPair(1);
  }
  private drawLimb(g:Phaser.GameObjects.Graphics,ax:number,ay:number,tx:number,ty:number,l1:number,l2:number,bendSide:number):void {
    const {joint,end}=solveLimb({x:ax,y:ay},{x:tx,y:ty},l1,l2,bendSide);
    const kx=joint.x,ky=joint.y,ex=end.x,ey=end.y;
    g.lineStyle(6.5,0x000000,1);g.beginPath();g.moveTo(ax,ay);g.lineTo(kx,ky);g.lineTo(ex,ey);g.strokePath();
    g.lineStyle(3.5,0xffffff,1);g.beginPath();g.moveTo(ax,ay);g.lineTo(kx,ky);g.lineTo(ex,ey);g.strokePath();
    g.fillStyle(0x000000);g.fillCircle(ex,ey,4);g.fillStyle(0xffffff);g.fillCircle(ex,ey,2.7);
  }
}
function overlap(x:number,y:number,w:number,h:number,p:Platform):boolean{return x<p.x+p.w&&x+w>p.x&&y<p.y+p.h&&y+h>p.y;}
