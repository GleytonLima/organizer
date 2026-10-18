# Brain Organizer — integração com o shell (copiado para %APPDATA% a cada início).
# Reproduz o startup de um login shell do Git Bash e emite sequências que o app entende:
#   OSC 6973;<nonce>;cwd;<C:/caminho>       diretório atual em formato Windows (a cada prompt)
#   OSC 6973;<nonce>;start;<comando>        um comando começou a executar
#   OSC 6973;<nonce>;end;<código de saída>  o comando terminou
# <nonce>: aleatório por terminal (BO_OSC_NONCE). Fica numa variável do shell, fora do ambiente dos
# comandos: a saída de um programa (cat, curl, testes…) não consegue forjar pasta/estado do terminal.
# O caminho vem de `pwd -W` (embutido no bash do Git, sem subprocesso): respeita os pontos de
# montagem do MSYS (ex.: /tmp → %TEMP%), que uma conversão ingênua de /c/... erraria.

__bo_n="$BO_OSC_NONCE"
unset BO_OSC_NONCE

[ -f /etc/profile ] && . /etc/profile
if [ -f ~/.bash_profile ]; then . ~/.bash_profile
elif [ -f ~/.bash_login ]; then . ~/.bash_login
elif [ -f ~/.profile ]; then . ~/.profile
elif [ -f ~/.bashrc ]; then . ~/.bashrc
fi

# CLI `bo` do app disponível em todo terminal aberto por ele.
[ -n "$BO_BIN" ] && PATH="$BO_BIN:$PATH"

# __bo_state: 0 = executando comando, 1 = pronto para o próximo, 2 = rodando o PROMPT_COMMAND
__bo_state=2

__bo_precmd() {
  local ec=$?
  [ "$__bo_state" = 0 ] && printf '\033]6973;%s;end;%s\007' "$__bo_n" "$ec"
  __bo_state=2
  printf '\033]6973;%s;cwd;' "$__bo_n"; builtin pwd -W; printf '\007' # a quebra de linha do pwd é descartada pelo app
}

__bo_arm() { __bo_state=1; }

__bo_preexec() {
  [ "$__bo_state" = 1 ] || return
  [ -n "$COMP_LINE" ] && return
  case "$BASH_COMMAND" in __bo_*) return ;; esac # Enter vazio cai direto no PROMPT_COMMAND
  __bo_state=0
  printf '\033]6973;%s;start;%s\007' "$__bo_n" "$BASH_COMMAND"
}

case ";${PROMPT_COMMAND};" in
  *";__bo_precmd;"*) ;;
  *) PROMPT_COMMAND="__bo_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND};__bo_arm" ;;
esac

# Não sobrescreve um trap DEBUG que o usuário já tenha (ex.: bash-preexec).
[ -z "$(trap -p DEBUG)" ] && trap '__bo_preexec' DEBUG
