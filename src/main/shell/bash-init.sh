# Bash Organizer — integração com o shell (copiado para %APPDATA% a cada início).
# Reproduz o startup de um login shell do Git Bash e emite sequências que o app entende:
#   OSC 7;file://host/caminho        diretório atual (a cada prompt)
#   OSC 6973;start;<comando>          um comando começou a executar
#   OSC 6973;end;<código de saída>    o comando terminou

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
  [ "$__bo_state" = 0 ] && printf '\033]6973;end;%s\007' "$ec"
  __bo_state=2
  printf '\033]7;file://localhost%s\007' "$PWD"
}

__bo_arm() { __bo_state=1; }

__bo_preexec() {
  [ "$__bo_state" = 1 ] || return
  [ -n "$COMP_LINE" ] && return
  case "$BASH_COMMAND" in __bo_*) return ;; esac # Enter vazio cai direto no PROMPT_COMMAND
  __bo_state=0
  printf '\033]6973;start;%s\007' "$BASH_COMMAND"
}

case ";${PROMPT_COMMAND};" in
  *";__bo_precmd;"*) ;;
  *) PROMPT_COMMAND="__bo_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND};__bo_arm" ;;
esac

# Não sobrescreve um trap DEBUG que o usuário já tenha (ex.: bash-preexec).
[ -z "$(trap -p DEBUG)" ] && trap '__bo_preexec' DEBUG
