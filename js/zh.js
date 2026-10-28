/* 中文 for TT Ice Climb. The page translates itself from this dictionary (kit/lang.js); names stay English. */
(function () {
  const MOUNTAINS = {
    'BUNNY HILL': '兔子小山', 'SNOWBALL PEAK': '雪球峰', 'CLOUDY TOP': '云朵顶', 'POLAR POINT': '北极角', 'ICICLE RIDGE': '冰柱岭',
    'MARSHMALLOW MOUNTAIN': '棉花糖山', 'RAINBOW RIDGE': '彩虹岭', 'SUPER SUMMIT': '超级山顶',
  };
  const VEG = { CARROT: '胡萝卜', CORN: '玉米', TOMATO: '番茄', BROCCOLI: '西兰花', POTATO: '土豆', PEPPER: '甜椒', CUCUMBER: '黄瓜', PUMPKIN: '南瓜' };
  const M = (s) => MOUNTAINS[s] || s;
  const V = (s) => VEG[s] || s;
  Kit.lang.keep(['TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'Teddy', 'Tommy', 'Foxy', 'Froggy', IC.TITLE, 'Claude Code', 'Esc']);
  Kit.lang.add(Object.assign({}, MOUNTAINS, {
    // title
    'Bonk the ice, hop up the hole, climb to the top!': '敲冰块，跳上洞，爬到冰山顶！',
    PLAYERS: '玩家', CLIMBER: '谁来爬', LEVEL: '难度', MOUNTAIN: '冰山',
    'Foxy & Froggy cheer you on': 'Foxy 和 Froggy 给你加油',
    'Teddy & Tommy climb together': 'Teddy 和 Tommy 一起爬',
    'boxing champ': '拳击冠军', 'peace sign pro': '比耶高手',
    'holes stay open · soft jumps · 5 lives': '洞不会被堵 · 跳得轻 · 5 条命',
    'the seal fills holes · 3 lives': '海豹会堵洞 · 3 条命',
    'CLIMB IT TO OPEN THE NEXT': '爬上去就能开下一座',
    'Easier mountain': '简单一点的冰山', 'Harder mountain': '难一点的冰山',
    Players: '玩家', Climber: '谁来爬', Difficulty: '难度',
    '▶ CLIMB!': '▶ 开爬！',
    'jump and bonk the ice': '跳起来敲冰块', 'swing the mallet': '挥锤子',
    "◀ ▶ walk, ⤴️ jumps and bonks the ice over your head, 🔨 swings the mallet. Tap your brother's face to call him!": '◀ ▶ 走路，⤴️ 跳起来敲头上的冰块，🔨 挥锤子。点兄弟的脸叫他来！',
    '↻ Turn sideways for a bigger mountain!': '↻ 横过来玩，冰山更大！',
    'LOADING…': '加载中…',
    // HUD and touch
    'HI-SCORE': '最高分', BONUS: '奖励关', LAYER: '层', 'HIGH FIVE': '击掌', 'HIGH 5': '击掌', '✋ HIGH FIVE': '✋ 击掌', JUMP: '跳', BONK: '敲', CALL: '叫人',
    'Pause (P)': '暂停 (P)', Pause: '暂停', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开或关', 'Sound on / off (M)': '声音 开 / 关 (M)',
    'Walk left': '往左走', 'Walk right': '往右走',
    // big words and pops
    'BONK!': '咚！', 'CLUNK!': '当！', 'ACHOO!': '阿嚏！', 'PUFF!': '噗！', 'WHOOPS!': '哎呀！', 'OOF!': '哎哟！', 'BUBBLE UP!': '泡泡飞起来！', 'PLOP!': '扑通！',
    'EXTRA LIFE!': '多一条命！', 'BONUS STAGE!': '奖励关！', 'TIME UP!': '时间到！', 'MOUNTAIN CLEAR!': '爬上冰山啦！', 'TOP OF THE WORLD!': '登上世界之巅！',
    '+5 SECONDS': '+5 秒', 'HIGH FIVE! ✋ +50': '击掌！✋ +50',
    // pause and results
    'P · Esc · Space to go on · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    '↻ PLAY AGAIN': '↻ 再玩一次', 'Enter: play again · Esc: menu': '回车：再玩一次 · Esc：菜单',
    'GREAT CLIMBING!': '爬得真棒！', 'TEAM CLIMB!': '兄弟一起爬！',
    '⭐ NEW HI-SCORE!': '⭐ 新纪录！', '⭐ ON THE BOARD!': '⭐ 上榜啦！',
    '🐣 TOP CLIMBERS': '🐣 攀登高手榜', '🔥 TOP CLIMBERS': '🔥 攀登高手榜',
    // the ? panel
    '1 player': '单人', '2 players: Teddy': '双人：Teddy', '2 players: Tommy': '双人：Tommy',
    'jump: the mallet bonks the ice over your head': '跳：锤子敲头上的冰块',
    'swing the mallet at a seal or a bird': '挥锤子打海豹或小鸟',
    'call your brother: he smashes the row above (2 players: high five)': '叫兄弟来：他把上面一整排冰块全敲碎（双人：击掌）',
    'title: 1 or 2 players · easy · normal · climber · mountain': '标题页：1 或 2 个人 · 简单 · 普通 · 换人 · 选冰山',
    'Jump under the ice to bonk the block over your head, then jump again to hop up through the hole. Ride the drifting clouds. Bonk seals and birds with the mallet and they float away. At the top, hop up the clouds and grab the giant vegetable before the timer runs out! Call your brother as often as you like.':
      '在冰块下面跳，敲碎头上的冰块，再跳一次就从洞里跳上去。可以站在飘动的云朵上。用锤子敲海豹和小鸟，它们就飘走啦。到了山顶，踩着云朵往上跳，在时间用完前抓住大蔬菜！兄弟想叫几次就叫几次。',
    "◀ ▶ walk, ⤴️ jumps, 🔨 swings the mallet, and your brother's face calls him. 2 players: a pad each.": '◀ ▶ 走路，⤴️ 跳，🔨 挥锤子，点兄弟的脸叫他来。双人：每人一组按钮。',
  }));
  Kit.lang.rule(/^(\d) · (.+)$/, (m, n, s) => `${n} · ${M(s)}`);
  Kit.lang.rule(/^(\d) OF (\d) OPEN$/, '已开 $1 / $2 座');
  Kit.lang.rule(/^MOUNTAIN (\d) · (.+)$/, (m, n, s) => `第 ${n} 座冰山 · ${M(s)}`);
  Kit.lang.rule(/^MOUNTAIN (\d)$/, '第 $1 座冰山');
  Kit.lang.rule(/^HI-SCORE ([\d,]+) · (\w+)$/, '最高分 $1 · $2');
  Kit.lang.rule(/^CALL (\w+)$/, '叫 $1');
  Kit.lang.rule(/^GRAB THE GIANT (\w+)!$/, (m, v) => `抓住大${V(v)}！`);
  Kit.lang.rule(/^(\S+) GIANT (\w+)!$/, (m, e, v) => `${e} 抓到大${V(v)}啦！`);
  Kit.lang.rule(/^ACHOO! \+(\d+)$/, '阿嚏！+$1');
  Kit.lang.rule(/^PUFF! \+(\d+)$/, '噗！+$1');
  Kit.lang.rule(/^(\w+) SAYS: SMASH!$/, '$1 说：全敲碎！');
  Kit.lang.rule(/^(\w+) SAYS: GO GO GO!$/, '$1 说：加油加油！');
  Kit.lang.rule(/^(\w+) IS OUT OF LIVES$/, '$1 没有命啦');
  Kit.lang.rule(/^(\w+) ([\d,]+) · (\w+) ([\d,]+)$/, '$1 $2 分 · $3 $4 分');
  Kit.lang.rule(/^([\d,]+) points · mountain (\d) of (\d)$/, '$1 分 · 第 $2 座冰山（共 $3 座）');
})();
